/* Local account login is a normal server-rendered form. */
document.addEventListener('click', async event => {
  if (!event.target.closest('.logout-button')) return;
  event.preventDefault();
  window.wsBrowserAI?.clear();
  try {
    const response = await fetch('/api/logout', { method: 'POST' });
    if (response.ok) {
      localStorage.removeItem('wisesloth_user');
      window.location.assign('/login');
    }
  } catch (error) { console.error('Sign out failed:', error); }
});
