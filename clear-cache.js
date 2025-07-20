// Clear browser caches and storage
// Run this in the browser console if still having issues

console.log('🧹 Clearing browser caches and storage...');

// Clear localStorage
if (typeof localStorage !== 'undefined') {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.includes('supabase') || key.includes('auth') || key.includes('session')) {
      console.log('Removing localStorage key:', key);
      localStorage.removeItem(key);
    }
  });
}

// Clear sessionStorage
if (typeof sessionStorage !== 'undefined') {
  const keys = Object.keys(sessionStorage);
  keys.forEach(key => {
    if (key.includes('supabase') || key.includes('auth') || key.includes('session')) {
      console.log('Removing sessionStorage key:', key);
      sessionStorage.removeItem(key);
    }
  });
}

// Clear all cookies
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});

console.log('✅ Cache clearing complete. Please refresh the page.');