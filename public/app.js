let landingSettings = {};

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (res.ok) {
      landingSettings = await res.json();
      applySettings();
    }
  } catch (err) {}
}

function applySettings() {
  const badge = document.querySelector('.badge');
  if (badge && landingSettings.badge) badge.textContent = landingSettings.badge;

  const priceEl = document.querySelector('.price');
  if (priceEl && landingSettings.precio) {
    const basePrice = parseFloat(landingSettings.precio);
    const descuentoActivo = landingSettings.descuento_activo === 'true';
    const descuentoPercent = parseInt(landingSettings.descuento_percent) || 0;

    if (descuentoActivo && descuentoPercent > 0 && descuentoPercent <= 100) {
      const finalPrice = Math.round(basePrice * (1 - descuentoPercent / 100));
      priceEl.innerHTML = `<span class="price-currency">USDT</span><span class="price-strikethrough">${basePrice}</span> ${finalPrice}`;
    } else {
      priceEl.innerHTML = `<span class="price-currency">USDT</span>${basePrice}`;
    }
  }

  const priceSuffix = document.querySelector('.price-suffix');
  if (priceSuffix && landingSettings.fecha) {
    priceSuffix.textContent = `pago único · 4 sesiones en vivo · máximo 3 personas · Fecha: ${landingSettings.fecha}`;
  }

  const formNote = document.querySelector('.form-note');
  if (formNote && landingSettings.fecha) {
    formNote.textContent = `Solo 3 cupos por cohorte. Próxima fecha: ${landingSettings.fecha}.`;
  }
}

document.getElementById('reservaForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const btn = document.getElementById('submitBtn');
  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const correo = document.getElementById('correo').value.trim();

  btn.disabled = true;
  btn.textContent = 'Enviando...';

  try {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, apellido, correo })
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.errors ? data.errors.join('\n') : (data.error || 'Error al enviar');
      alert(msg);
      return;
    }

    const whatsapp = landingSettings.whatsapp || '584123456789';
    const precio = data.precio_final || landingSettings.precio || '150';
    const descuentoActivo = landingSettings.descuento_activo === 'true';
    const descuentoPercent = parseInt(landingSettings.descuento_percent) || 0;

    let precioMsg = `Precio: ${precio} USDT`;
    if (descuentoActivo && descuentoPercent > 0) {
      precioMsg = `Precio promocional: ${precio} USDT (descuento ${descuentoPercent}%)`;
    }

    const mensaje = encodeURIComponent(
      'Hola, quiero reservar mi cupo para la Mentoría Binance Venezuela.\n\n' +
      'Nombre: ' + nombre + ' ' + apellido + '\n' +
      'Correo: ' + correo + '\n' +
      precioMsg + '\n\n' +
      '¿Cómo puedo confirmar mi pago?'
    );

    window.open('https://wa.me/' + whatsapp + '?text=' + mensaje, '_blank');
  } catch (err) {
    alert('Error de conexión. Intenta de nuevo.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Solicitar cupo por WhatsApp';
  }
});

loadSettings();
