const fs = require('fs');

['src/app/dashboard/page.tsx', 'src/app/dashboard/settings/page.tsx', 'src/app/dashboard/users/page.tsx'].forEach(file => {
  if (fs.existsSync(file)) {
    let code = fs.readFileSync(file, 'utf8');
    
    // Broaden permission: CEO/Admin, CEO/MD, HR Manager, or email containing 'nithya'
    const targetPattern = /const canManageGeofenceMode = [^;]+;/;
    const replacement = `const isNithya = 
    currentUser?.email?.toLowerCase()?.includes('nithya') ||
    currentUserData?.email?.toLowerCase()?.includes('nithya') ||
    (currentUserData?.firstName?.toLowerCase()?.includes('nithya') && currentUserData?.role === 'HR Manager');

  const canManageGeofenceMode = currentUserData?.role === 'CEO/Admin' || 
    currentUserData?.role === 'CEO/MD' || 
    currentUserData?.role === 'HR Manager' ||
    isNithya;`;
    
    if (targetPattern.test(code)) {
      code = code.replace(targetPattern, replacement);
      fs.writeFileSync(file, code, 'utf8');
      console.log('Updated permission in', file);
    } else {
      console.log('Pattern not found in', file);
    }
  }
});

