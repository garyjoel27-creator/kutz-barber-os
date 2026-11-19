# Original User Request

## 2026-10-29T00:19:28Z

Rediseño integral de la experiencia visual y usabilidad de KUTZ // BARBER OS: sustitución de la estética plana genérica por una atmósfera inmersiva de barbería urbana con fondos reales y desenfoque glassmorphism, incorporación de una rejilla Bento con tarjetas interactivas de cliente con volteo 3D (3D Flip Cards), y simplificación radical del Dashboard para eliminar el ruido cognitivo del dueño.

Working directory: C:\Users\zigac\Documents\antigravity\happy-turing\luminadesk
Integrity mode: development

## Requirements

### R1. Fondos Atmosféricos de Barbería Real y Glassmorphism
Integrar fondos fotográficos de alta fidelidad que transmitan la atmósfera auténtica de una barbería urbana de autor (ladrillo visto, sillones vintage de cuero negro, iluminación de estudio y texturas de hormigón pulido), aplicando capas de desenfoque profundo (backdrop-blur-md / backdrop-blur-lg) y veladuras oscuras con contraste WCAG para asegurar que el texto, las métricas y los controles sigan siendo 100% legibles.

### R2. Rejilla Bento Dinámica con Tarjetas de Cliente con Volteo 3D (Flip Cards)
Diseñar e implementar una rejilla visual Bento donde cada cliente está representado por una tarjeta con rotación 3D realista (transform-style: preserve-3d, rotateY(180deg)):
- Cara Frontal (Identidad & Urgencia): Fotografía del cliente a gran escala, nombre en tipografía editorial, badge dinámico de alerta de fade (p. ej. "🔥 Retoque en 2 días"), estado del bono VIP y botón rápido de WhatsApp.
- Cara Trasera (Ficha Técnica & Ajustes): Al pulsar "Voltear" o en la esquina interactiva, la tarjeta gira suavemente en 3D revelando la fórmula del corte (guardas #000 a #3, fade seleccionado, ritual), notas privadas del barbero y botón para editar o añadir nueva sesión, todo sin abrir modales molestos ni cambiar de pantalla.

### R3. Descongestión del Dashboard y Simplificación para el Dueño
Reestructurar la pantalla principal para que el dueño de la barbería entienda la situación de su negocio en menos de 3 segundos sin sentirse abrumado por números y cajas densas:
- Vista en primer plano centrada en lo prioritario: Estado de los sillones en tiempo real + Cola de espera / Walk-ins activos + Acceso rápido a clientes del día.
- Agrupar métricas secundarias en vistas colapsables o cajones contextuales limpios, eliminando el ruido visual.

### R4. Micro-interacciones Táctiles y Animaciones Fluidas (60 FPS)
Asegurar que todas las transiciones (giro de tarjetas, apertura del Kiosko TV, cambio de estado de sillones) utilicen aceleración por hardware (GPU), se sientan naturales e intuitivas tanto en ratón como en pantallas táctiles (tablets de cabina y móviles), y cuenten con sutiles efectos de feedback táctil/sonoro.

### R5. Compilación Limpia y Despliegue en Netlify Producción
Ejecutar una compilación de producción impecable (npm run build) con código 0, verificar la ausencia de errores de consola o desbordamientos en resoluciones móviles (~390px) y escritorio (1280px+), y desplegar la versión final a Netlify producción.

## Acceptance Criteria

### Visual & Atmospheric Aesthetics
- [ ] La interfaz utiliza fondos de barbería real de alta resolución con capas oscuras y backdrop-blur elegante, eliminando la sensación de plantilla genérica o hecha por IA.
- [ ] Todos los textos, badges y botones mantienen un contraste nítido y legible sobre el fondo.

### 3D Card Interaction
- [ ] Las tarjetas de la vista de clientes y del showcase se voltean 180° en 3D mediante una animación fluida a 60 FPS.
- [ ] La cara frontal muestra foto, nombre, estado de retoque y bono VIP; la cara trasera expone la fórmula de corte (guardas y fade) y notas técnicas.
- [ ] El giro 3D funciona fluidamente tanto con clic de ratón como con toque en dispositivos móviles y tablets.

### Dashboard Usability
- [ ] El Dashboard reduce la sobrecarga visual, mostrando en primer término los sillones en vivo, la cola y las llamadas a la acción directas.
- [ ] La navegación resulta intuitiva para el usuario sin requerir explicaciones técnicas.

### Build & Production Deployment
- [ ] npm run build compila con éxito (exit code 0) sin errores de sintaxis, dependencias o CSS.
- [ ] La aplicación se despliega a la URL de producción de Netlify y las nuevas tarjetas 3D y fondos son verificables en vivo.
