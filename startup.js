if (!window.isSecureContext || location.protocol === 'file:') {
  document.getElementById('boot-message').textContent =
    'Откройте Inkrail по HTTPS или по адресу http://localhost:8000, а не напрямую из файла. Инструкция — в README.md.';
}
