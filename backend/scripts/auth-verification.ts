process.env.NODE_ENV = 'test';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/db/prisma';

async function runAuthVerification() {
  console.log('====================================================');
  console.log('🔐 VERIFYING AUTHENTICATION & CORS RESOLUTION');
  console.log('====================================================');

  const testEmail = `auth.fix.${Date.now()}@campusbites.test`;
  const testPassword = 'SecurePassword123!';

  try {
    // 1. CORS Preflight & Origin check for Vercel and Localhost
    console.log('\n[1/4] Testing CORS headers for Vercel and Localhost...');
    const corsVercel = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://campus-bites-frontend.vercel.app')
      .set('Access-Control-Request-Method', 'POST');
    
    if (corsVercel.headers['access-control-allow-origin'] !== 'https://campus-bites-frontend.vercel.app') {
      throw new Error(`CORS failed for Vercel origin. Header: ${corsVercel.headers['access-control-allow-origin']}`);
    }
    console.log('  ✅ PASS: Vercel origin (https://*.vercel.app) permitted via CORS');

    const corsLocal = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    
    if (corsLocal.headers['access-control-allow-origin'] !== 'http://localhost:5173') {
      throw new Error(`CORS failed for localhost:5173. Header: ${corsLocal.headers['access-control-allow-origin']}`);
    }
    console.log('  ✅ PASS: Localhost origin (http://localhost:5173) permitted via CORS');

    // 2. User Registration with whitespace and mixed casing
    console.log('\n[2/4] Testing User Registration with whitespace trimming...');
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: '  Test Registration User  ',
        email: `  ${testEmail.toUpperCase()}  `,
        password: testPassword,
        phone: ' 9876543299 '
      });

    if (regRes.status !== 201) {
      throw new Error(`Registration failed with status ${regRes.status}: ${JSON.stringify(regRes.body)}`);
    }
    if (!regRes.body.token || !regRes.body.user) {
      throw new Error('Registration did not return token and user object');
    }
    if (regRes.body.user.email !== testEmail.toLowerCase()) {
      throw new Error(`Email not normalized. Got: ${regRes.body.user.email}`);
    }
    console.log('  ✅ PASS: Registration succeeds, normalizes email and issues JWT token');

    // 3. User Login with normalized email
    console.log('\n[3/4] Testing User Login...');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: ` ${testEmail} `,
        password: testPassword
      });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed with status ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
    }
    if (!loginRes.body.token || !loginRes.body.user) {
      throw new Error('Login did not return token and user');
    }
    console.log('  ✅ PASS: Login succeeds with correct credentials');

    // 4. Invalid Password Handling
    console.log('\n[4/4] Testing Invalid Credentials...');
    const badLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'wrong_password_attempt'
      });

    if (badLoginRes.status !== 401) {
      throw new Error(`Expected 401, got ${badLoginRes.status}`);
    }
    if (badLoginRes.body.error !== 'Invalid credentials') {
      throw new Error(`Expected 'Invalid credentials', got: ${badLoginRes.body.error}`);
    }
    console.log('  ✅ PASS: Invalid credentials return strict 401 with informative error message');

    // Clean up test user
    await prisma.userRole.deleteMany({ where: { user: { email: testEmail.toLowerCase() } } });
    await prisma.user.deleteMany({ where: { email: testEmail.toLowerCase() } });
    console.log('  ✅ Cleaned up temporary test user');

    console.log('\n====================================================');
    console.log('🏁 ALL 4 AUTHENTICATION & CORS CHECKS PASSED');
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAuthVerification();
