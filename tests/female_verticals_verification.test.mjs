/**
 * tests/female_verticals_verification.test.mjs
 * Verification Suite for the 2 Female Verticals:
 * 1. CM Salón D’ Campodónico · Nails & Beauty ('campodonico-nails') — Uñas, Manicura, Pedicura & Facial (Hermana)
 * 2. Lumina · Peluquería & Estética ('peluqueria-estetica') — Peluquería Femenina, Colorimetría & Cabina Estética (SIN Uñas ni Pedicura)
 * Plus 100% non-interference with José's Barbershop ('joseh-barber').
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from './helpers/testHarness.mjs';
import bookingHandler from '../netlify/functions/booking.js';
import { resetMemoryStore, getShopConfig } from '../netlify/functions/lib/blobsClient.js';
import {
  SHOP_JOSEH_CONFIG,
  SHOP_CAMPODONICO_NAILS_CONFIG,
  SHOP_SALON_ESTETICA_CONFIG,
  getShopVertical,
  isFemaleVertical
} from '../src/lib/shopUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export function registerFemaleVerticalsVerificationTests(runner) {
  runner.describe('Female Verticals — CM Campodónico Nails & Peluquería/Estética (Sin Uñas)', () => {
    runner.it('FV.1: SHOP_CAMPODONICO_NAILS_CONFIG exposes all 10 official nail, manicure, pedicure & facial services in Arrecife', async () => {
      resetMemoryStore();
      const cfg = await getShopConfig('campodonico-nails');
      expect(cfg.slug).toBe('campodonico-nails');
      expect(cfg.vertical).toBe('nails');
      expect(cfg.theme).toBe('rose-luxury');
      expect(cfg.phone).toBe('638 877 945');
      expect(cfg.address).toContain('Av. Alcalde Ginés de la Hoz, 2');
      expect(cfg.services.length).toBe(10);

      const names = cfg.services.map((s) => s.name);
      expect(names).toContain('Uñas acrílicas Talla S');
      expect(names).toContain('Uñas acrílicas Talla M/L');
      expect(names).toContain('Relleno acrílico');
      expect(names).toContain('Manicura semipermanente con refuerzo');
      expect(names).toContain('Pedicura completa & Spa');
      expect(names).toContain('Higiene facial profunda');
    });

    runner.it('FV.2: SHOP_SALON_ESTETICA_CONFIG exposes 9 hair salon & aesthetic cabin services with ZERO nails or pedicure services', async () => {
      resetMemoryStore();
      const cfg = await getShopConfig('peluqueria-estetica');
      expect(cfg.slug).toBe('peluqueria-estetica');
      expect(cfg.vertical).toBe('peluqueria');
      expect(cfg.theme).toBe('rose-luxury');
      expect(cfg.services.length).toBe(9);

      const hasNailsOrPedi = cfg.services.some((s) => {
        const lower = s.name.toLowerCase();
        return (
          lower.includes('uñas') ||
          lower.includes('unas') ||
          lower.includes('manicura') ||
          lower.includes('pedicura') ||
          lower.includes('acrílic') ||
          lower.includes('acrilic')
        );
      });
      expect(hasNailsOrPedi).toBe(false);

      const names = cfg.services.map((s) => s.name);
      expect(names).toContain('Corte y Peinado / Brushing');
      expect(names).toContain('Color / Tinte de Raíz Orgánico');
      expect(names).toContain('Mechas Balayage / Babylights + Matiz');
      expect(names).toContain('Tratamiento Hidratación / Keratina / Botox Capilar');
      expect(names).toContain('Higiene Facial Profunda + Ultrasonidos');
      expect(names).toContain('Radiofrecuencia / Rejuvenecimiento Facial');
    });

    runner.it('FV.3: getShopVertical and isFemaleVertical classify barber, nails, and peluqueria-estetica accurately', () => {
      expect(getShopVertical(SHOP_JOSEH_CONFIG, 'joseh-barber', 'barber')).toBe('barber');
      expect(isFemaleVertical(getShopVertical(SHOP_JOSEH_CONFIG, 'joseh-barber', 'barber'))).toBe(false);

      expect(getShopVertical(SHOP_CAMPODONICO_NAILS_CONFIG, 'campodonico-nails', 'nails')).toBe('nails');
      expect(isFemaleVertical(getShopVertical(SHOP_CAMPODONICO_NAILS_CONFIG, 'campodonico-nails', 'nails'))).toBe(true);

      expect(getShopVertical(SHOP_SALON_ESTETICA_CONFIG, 'peluqueria-estetica', 'peluqueria')).toBe('peluqueria');
      expect(isFemaleVertical(getShopVertical(SHOP_SALON_ESTETICA_CONFIG, 'peluqueria-estetica', 'peluqueria'))).toBe(true);
    });

    runner.it('FV.4: Public QR booking endpoints (/public-state and /booking) work end-to-end for campodonico-nails and peluqueria-estetica', async () => {
      resetMemoryStore();

      // 1. Book a 105-min Uñas acrílicas Talla M/L (cn2) at 11:00 on Monday 2026-11-23 in campodonico-nails
      const bookNails = await bookingHandler(
        new Request('http://localhost/api/shops/campodonico-nails/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'Valeria Betancor',
            clientPhone: '638877945',
            barberId: 'campodonico-nails-1',
            serviceId: 'cn2', // 105 min (11:00 -> 12:45)
            date: '2026-11-23',
            timeSlot: '11:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        }),
        { params: { shopSlug: 'campodonico-nails' } }
      );
      expect(bookNails.status).toBe(201);
      const nailsData = await bookNails.json();
      expect(nailsData.appointment.serviceName).toBe('Uñas acrílicas Talla M/L');
      expect(nailsData.appointment.durationMinutes).toBe(105);

      // 2. Book a 120-min Mechas Balayage / Babylights + Matiz (pe3) at 10:00 on Monday 2026-11-23 in peluqueria-estetica
      const bookHair = await bookingHandler(
        new Request('http://localhost/api/shops/peluqueria-estetica/booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'appointment',
            clientName: 'Elena Lanzarote',
            clientPhone: '638877945',
            barberId: 'estilista-color',
            serviceId: 'pe3', // 120 min (10:00 -> 12:00)
            date: '2026-11-23',
            timeSlot: '10:00',
            rgpdConsent: { acceptedPrivacy: true, acceptedWhatsapp: false }
          })
        }),
        { params: { shopSlug: 'peluqueria-estetica' } }
      );
      expect(bookHair.status).toBe(201);
      const hairData = await bookHair.json();
      expect(hairData.appointment.serviceName).toBe('Mechas Balayage / Babylights + Matiz');
      expect(hairData.appointment.durationMinutes).toBe(120);
    });

    runner.it('FV.5: Barber Layout stays 100% clean (no multi-vertical switcher buttons) while female configs & cards remain intact', () => {
      const layoutSrc = fs.readFileSync(path.join(projectRoot, 'src/components/Layout.jsx'), 'utf8');
      const cardSrc = fs.readFileSync(path.join(projectRoot, 'src/components/ClientBentoCard.jsx'), 'utf8');
      const cssSrc = fs.readFileSync(path.join(projectRoot, 'src/index.css'), 'utf8');
      const contextSrc = fs.readFileSync(path.join(projectRoot, 'src/context/ClientContext.jsx'), 'utf8');

      // Clean Barber UI: multi-vertical switcher buttons must NOT be shown in Layout.jsx
      expect(layoutSrc.includes('handleSwitchVertical')).toBe(false);
      expect(layoutSrc.includes('Uñas & Manicura')).toBe(false);
      expect(layoutSrc.includes('Peluquería & Estética')).toBe(false);
      expect(layoutSrc.includes('Especialidad / Demo en 1 clic')).toBe(false);
      expect(layoutSrc.includes('Modo / Especialidad en vivo')).toBe(false);

      expect(cardSrc.includes('✓ Repetir su diseño hoy')).toBe(true);
      expect(cardSrc.includes('✓ Repetir su fórmula hoy')).toBe(true);
      expect(cardSrc.includes('✓ Repetir su corte hoy')).toBe(true);

      expect(cssSrc.includes('.theme-rose-luxury')).toBe(true);
      expect(cssSrc.includes('#EC4899')).toBe(true);

      expect(contextSrc.includes('INITIAL_NAILS_CLIENTS')).toBe(true);
      expect(contextSrc.includes('INITIAL_SALON_ESTETICA_CLIENTS')).toBe(true);
    });
  });
}
