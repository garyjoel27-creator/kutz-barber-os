/**
 * tests/pilar1_6_verification.test.mjs
 * Comprehensive Verification Suite for Pillars 1–5 against the REAL serverless handlers and utilities:
 * - Pillar 1: Security & RGPD (No isJosehDefaultFallback backdoor, no pin leaked in /sync, paused shop 403)
 * - Pillar 2: Multi-Tenant Clean Provisioning (Zero fake Madrid clients in new shops or joseh-barber, full sync actions)
 * - Pillar 3 & 4: Real Interval Collision Engine, Closing-Time Enforcement, Closed Sundays, Break Blocks & WhatsApp +34
 */

import { expect } from './helpers/testHarness.mjs';
import bookingHandler from '../netlify/functions/booking.js';
import syncHandler from '../netlify/functions/sync.js';
import adminHandler from '../netlify/functions/admin.js';
import {
  resetMemoryStore,
  getShopConfig,
  setShopConfig,
  getShopClients,
  setShopClients,
  getShopAppointments,
  getShopQueue
} from '../netlify/functions/lib/blobsClient.js';
import {
  SHOP_JOSEH_CONFIG,
  formatWhatsAppPhone,
  buildWhatsAppUrl
} from '../src/lib/shopUtils.js';
import { loadClientsFromStorage } from '../src/lib/storage.js';

export function registerPilar1To6VerificationTests(runner) {
  runner.describe('Pillars 1–5 — Real Handlers Security, Multi-Tenant & Interval Booking Verification', () => {
    runner.it('P1.1: sync.js rejects 1234 backdoor on joseh-barber (401), accepts real PIN 2023 (200), and omits pin from returned config', async () => {
      resetMemoryStore();
      await getShopConfig('joseh-barber'); // seeds joseh-barber with pin 2023

      // Attempt legacy 1234 backdoor -> must be 401 Unauthorized
      const backdoorReq = new Request('http://localhost/api/shops/joseh-barber/sync', {
        method: 'GET',
        headers: { 'x-shop-pin': '1234' }
      });
      const backdoorRes = await syncHandler(backdoorReq, { params: { shopSlug: 'joseh-barber' } });
      expect(backdoorRes.status).toBe(401);

      // Authentic PIN 2023 -> 200 OK and config.pin is stripped
      const validReq = new Request('http://localhost/api/shops/joseh-barber/sync', {
        method: 'GET',
        headers: { 'x-shop-pin': '2023' }
      });
      const validRes = await syncHandler(validReq, { params: { shopSlug: 'joseh-barber' } });
      expect(validRes.status).toBe(200);
      const data = await validRes.json();
      expect(data.success).toBe(true);
      expect(data.config.pin).toBeUndefined();
    });

    runner.it('P1.2: Paused shop returns 403 with paused: true on both GET /public-state and POST /booking', async () => {
      resetMemoryStore();
      await setShopConfig('joseh-barber', { ...SHOP_JOSEH_CONFIG, status: 'paused' });

      const getRes = await bookingHandler(
        new Request('http://localhost/api/shops/joseh-barber/public-state?date=2026-11-23', { method: 'GET' }),
        { params: { shopSlug: 'joseh-barber' } }
      );
      expect(getRes.status).toBe(403);
      const getBody = await getRes.json();
      expect(getBody.paused).toBe(true);
      expect(getBody.error).toBe('shop_inactive');

      const postRes = await bookingHandler(
        new Request('http://localhost/api/shops/joseh-barber/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'Cliente Pausa',
            clientPhone: '689014014',
            serviceId: 's1',
            date: '2026-11-23',
            timeSlot: '11:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        }),
        { params: { shopSlug: 'joseh-barber' } }
      );
      expect(postRes.status).toBe(403);
      const postBody = await postRes.json();
      expect(postBody.paused).toBe(true);
    });

    runner.it('P2.1: New shops provisioned via POST /api/admin/shops start with 0 fake Madrid clients and preserve full metadata & hoursByDay on PATCH', async () => {
      resetMemoryStore();

      const createRes = await adminHandler(
        new Request('http://localhost/api/admin/shops', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': 'kutz-superadmin-2026'
          },
          body: JSON.stringify({
            slug: 'barberia-lanzarote-futura',
            name: 'Barbería Lanzarote Futura',
            pin: '4567',
            phone: '689 000 111',
            address: 'Calle Real 10, Arrecife',
            barbers: [{ id: 'b-lanz', name: 'Carlos Master', specialty: 'Fade & Barba' }],
            services: [{ id: 's-corte', name: 'Corte Lanzarote', durationMinutes: 45, price: 18 }],
            schedule: {
              openTime: '09:30',
              closeTime: '19:30',
              slotMinutes: 45,
              workDays: [1, 2, 3, 4, 5, 6],
              hoursByDay: {
                1: { openTime: '09:30', closeTime: '19:30' },
                6: { openTime: '09:00', closeTime: '14:00' }
              }
            }
          })
        }),
        {}
      );
      expect(createRes.status).toBe(201);

      // Must have 0 fake Madrid clients
      const clients = await getShopClients('barberia-lanzarote-futura');
      expect(clients.length).toBe(0);

      // GET /api/admin/shops returns enriched pin, phone, address, barbers, services
      const listRes = await adminHandler(
        new Request('http://localhost/api/admin/shops', {
          method: 'GET',
          headers: { 'x-admin-key': 'kutz-superadmin-2026' }
        }),
        {}
      );
      const listData = await listRes.json();
      const found = listData.shops.find((s) => s.slug === 'barberia-lanzarote-futura');
      expect(found).toBeDefined();
      expect(found.pin).toBe('4567');
      expect(found.phone).toBe('689 000 111');
      expect(found.address).toBe('Calle Real 10, Arrecife');

      // PATCH schedule deep-merges hoursByDay without losing day 6
      const patchRes = await adminHandler(
        new Request('http://localhost/api/admin/shops/barberia-lanzarote-futura', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': 'kutz-superadmin-2026'
          },
          body: JSON.stringify({
            schedule: {
              hoursByDay: {
                5: { openTime: '09:00', closeTime: '21:00' }
              }
            }
          })
        }),
        { params: { shopSlug: 'barberia-lanzarote-futura' } }
      );
      expect(patchRes.status).toBe(200);
      const updatedCfg = await getShopConfig('barberia-lanzarote-futura');
      expect(updatedCfg.schedule.hoursByDay[6].closeTime).toBe('14:00');
      expect(updatedCfg.schedule.hoursByDay[5].closeTime).toBe('21:00');
    });

    runner.it('P2.2: getShopClients automatically purges legacy seeded Madrid demo clients from joseh-barber while keeping real clients', async () => {
      resetMemoryStore();
      await setShopClients('joseh-barber', [
        { id: '1', name: 'Marcos Varela' },
        { id: '2', name: 'Dani Morales' },
        { id: '3', name: 'Álex Rivera' },
        { id: 'c-real-1', name: 'Cliente Real Arrecife', phone: '689014014' }
      ]);

      const cleaned = await getShopClients('joseh-barber');
      expect(cleaned.length).toBe(1);
      expect(cleaned[0].name).toBe('Cliente Real Arrecife');
    });

    runner.it('P2.3: POST /api/shops/:slug/sync supports add_walkin, remove_walkin, upsert_client, delete_client, delete_appointment, and update_shop_schedule', async () => {
      resetMemoryStore();
      await getShopConfig('joseh-barber');

      const postSync = async (action, payload) => {
        const res = await syncHandler(
          new Request('http://localhost/api/shops/joseh-barber/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-shop-pin': '2023'
            },
            body: JSON.stringify({ action, payload })
          }),
          { params: { shopSlug: 'joseh-barber' } }
        );
        return { status: res.status, body: await res.json() };
      };

      // 1. Walk-in add & remove
      const wAdd = await postSync('add_walkin', { id: 'wq-test-1', name: 'Turno Arrecife', service: 'Corte' });
      expect(wAdd.status).toBe(200);
      expect((await getShopQueue('joseh-barber')).length).toBe(1);

      const wRem = await postSync('remove_walkin', { queueId: 'wq-test-1' });
      expect(wRem.status).toBe(200);
      expect((await getShopQueue('joseh-barber')).length).toBe(0);

      // 2. Client upsert & delete
      const cUpsert = await postSync('upsert_client', { id: 'c-100', name: 'Yeray Lanzarote', treatment: 'Fade' });
      expect(cUpsert.status).toBe(200);
      expect((await getShopClients('joseh-barber')).some((c) => c.id === 'c-100')).toBe(true);

      const cDel = await postSync('delete_client', { clientId: 'c-100' });
      expect(cDel.status).toBe(200);
      expect((await getShopClients('joseh-barber')).some((c) => c.id === 'c-100')).toBe(false);

      // 3. Appointment add & delete
      const aAdd = await postSync('add_appointment', {
        id: 'apt-block-1',
        clientName: '🔒 Bloqueo / Descanso',
        date: '2026-11-23',
        timeSlot: '14:00',
        durationMinutes: 60,
        isBlock: true
      });
      expect(aAdd.status).toBe(201);
      expect((await getShopAppointments('joseh-barber')).length).toBe(1);

      const aDel = await postSync('delete_appointment', { appointmentId: 'apt-block-1' });
      expect(aDel.status).toBe(200);
      expect((await getShopAppointments('joseh-barber')).length).toBe(0);

      // 4. Schedule update
      const sUpd = await postSync('update_shop_schedule', {
        schedule: {
          hoursByDay: { 1: { openTime: '09:30', closeTime: '18:30' } }
        }
      });
      expect(sUpd.status).toBe(200);
      expect((await getShopConfig('joseh-barber')).schedule.hoursByDay[1].openTime).toBe('09:30');
    });

    runner.it('P2.4: loadClientsFromStorage preserves edits to client id === "3" (Álex Rivera)', () => {
      const mockStorage = {
        getItem: () =>
          JSON.stringify([
            { id: '3', name: 'Álex Rivera', treatment: 'Nuevo Corte Editado Hoy' }
          ])
      };
      const loaded = loadClientsFromStorage(mockStorage, [
        { id: '1' },
        { id: '2' },
        { id: '3', name: 'Álex Rivera', treatment: 'Viejo Corte' }
      ]);
      expect(loaded[0].treatment).toBe('Nuevo Corte Editado Hoy');
    });

    runner.it('P4.1: Sunday closed returns availability: [] on GET /public-state and 400 on POST /booking; closing boundary blocks 120m service at 17:30', async () => {
      resetMemoryStore();
      await getShopConfig('joseh-barber'); // Mon-Thu 10:00-18:00, Sun closed

      // 2026-11-22 is Sunday
      const sunRes = await bookingHandler(
        new Request('http://localhost/api/shops/joseh-barber/public-state?date=2026-11-22', { method: 'GET' }),
        { params: { shopSlug: 'joseh-barber' } }
      );
      const sunData = await sunRes.json();
      expect(sunData.closedOnDate).toBe(true);
      expect(sunData.availability.length).toBe(0);

      // 2026-11-23 is Monday (closes at 18:00). Service s15 is 120 min (Tinte completo blanco).
      // Attempting to book s15 at 17:00 (17:00 + 120m = 19:00 > 18:00) must fail with 400 outside_business_hours!
      const overCloseRes = await bookingHandler(
        new Request('http://localhost/api/shops/joseh-barber/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'Cliente Tinte',
            clientPhone: '689014014',
            barberId: 'joseh',
            serviceId: 's15', // 120 min
            date: '2026-11-23',
            timeSlot: '17:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        }),
        { params: { shopSlug: 'joseh-barber' } }
      );
      expect(overCloseRes.status).toBe(400);
      const overCloseData = await overCloseRes.json();
      expect(overCloseData.error).toBe('outside_business_hours');
    });

    runner.it('P4.2: Interval overlap and manual break blocks prevent overlapping bookings and persist full service metadata', async () => {
      resetMemoryStore();
      await getShopConfig('joseh-barber');

      // 1. Book a 90-minute service (s13: Mechas o mechón blanco, 90 min, 40€) at 11:00 on Monday 2026-11-23 (occupies 11:00 -> 12:30)
      const book1 = await bookingHandler(
        new Request('http://localhost/api/shops/joseh-barber/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'Cliente 11h',
            clientPhone: '689014014',
            barberId: 'joseh',
            serviceId: 's13', // 90 min
            date: '2026-11-23',
            timeSlot: '11:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        }),
        { params: { shopSlug: 'joseh-barber' } }
      );
      expect(book1.status).toBe(201);
      const book1Data = await book1.json();
      expect(book1Data.appointment.serviceName).toBe('Mechas o mechón blanco');
      expect(book1Data.appointment.durationMinutes).toBe(90);
      expect(book1Data.appointment.price).toBe(40);
      expect(book1Data.appointment.barberId).toBe('joseh');

      // 2. Attempt to book at 12:00 (overlaps 11:00-12:30!) -> must return 409 slot_unavailable
      const bookOverlap = await bookingHandler(
        new Request('http://localhost/api/shops/joseh-barber/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'Cliente Solapado 12h',
            clientPhone: '600111222',
            barberId: 'joseh',
            serviceId: 's5', // 30 min
            date: '2026-11-23',
            timeSlot: '12:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        }),
        { params: { shopSlug: 'joseh-barber' } }
      );
      expect(bookOverlap.status).toBe(409);

      // 3. Barber adds a manual break block at 15:00 (60 min) via sync.js
      await syncHandler(
        new Request('http://localhost/api/shops/joseh-barber/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-shop-pin': '2023' },
          body: JSON.stringify({
            action: 'add_appointment',
            payload: {
              clientName: '🔒 Bloqueo / Descanso',
              date: '2026-11-23',
              timeSlot: '15:00',
              durationMinutes: 60,
              status: 'confirmed',
              isBlock: true
            }
          })
        }),
        { params: { shopSlug: 'joseh-barber' } }
      );

      // 4. Attempting to book over the 15:00 break block must return 409 slot_unavailable
      const bookOverBreak = await bookingHandler(
        new Request('http://localhost/api/shops/joseh-barber/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'Cliente En Descanso',
            clientPhone: '600333444',
            serviceId: 's1',
            date: '2026-11-23',
            timeSlot: '15:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        }),
        { params: { shopSlug: 'joseh-barber' } }
      );
      expect(bookOverBreak.status).toBe(409);

      // 5. GET /public-state marks 11:00, 12:00, and 15:00 as available: false
      const pubRes = await bookingHandler(
        new Request('http://localhost/api/shops/joseh-barber/public-state?date=2026-11-23', { method: 'GET' }),
        { params: { shopSlug: 'joseh-barber' } }
      );
      const pubData = await pubRes.json();
      const slot11 = pubData.availability.find((s) => s.time === '11:00');
      const slot12 = pubData.availability.find((s) => s.time === '12:00');
      const slot15 = pubData.availability.find((s) => s.time === '15:00');
      const slot16 = pubData.availability.find((s) => s.time === '16:00');
      expect(slot11.available).toBe(false);
      expect(slot12.available).toBe(false);
      expect(slot15.available).toBe(false);
      expect(slot16.available).toBe(true);
    });

    runner.it('P4.3: formatWhatsAppPhone & buildWhatsAppUrl normalize 9-digit Spanish phones with 34 prefix', () => {
      expect(formatWhatsAppPhone('689 014 014')).toBe('34689014014');
      expect(formatWhatsAppPhone('+34 622 345 678')).toBe('34622345678');
      expect(buildWhatsAppUrl('689 014 014', 'Hola José')).toContain(
        'https://wa.me/34689014014?text=Hola%20Jos%C3%A9'
      );
    });
  });
}
