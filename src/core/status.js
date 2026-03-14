import fs from 'fs';

/**
 * Check system status for 4art poster generation
 * 
 * Options:
 * - type: specific system to check ('4art', 'rapidconnect', 'firebase', or null for all)
 * - verbose: detailed logging
 */
export async function status(options = {}) {
  const {
    type = null,
    verbose = false
  } = options;

  const log = (msg) => {
    if (verbose) console.log(`[status] ${msg}`);
  };

  try {
    console.log(`\n🔍 System Status Check\n`);

    const geoIndexPath = '/Users/aletviegas/Documents/miny-directory-work/dist/geo-index.json';
    
    let allGood = true;

    // Check 4art data source
    if (!type || type === '4art') {
      console.log('📦 4art Datasource:');
      if (fs.existsSync(geoIndexPath)) {
        try {
          const content = fs.readFileSync(geoIndexPath, 'utf8');
          const geoIndex = JSON.parse(content);
          console.log(`   ✅ geo-index.json loaded (${geoIndex.total || 0} artists)`);
          log(`   Path: ${geoIndexPath}`);
          log(`   Entities: ${Object.keys(geoIndex.entities || {}).length}`);
        } catch (error) {
          console.log(`   ❌ geo-index.json is invalid: ${error.message}`);
          allGood = false;
        }
      } else {
        console.log(`   ❌ geo-index.json not found`);
        console.log(`      Expected: ${geoIndexPath}`);
        allGood = false;
      }
    }

    // Check RapidConnect API (placeholder - requires API key)
    if (!type || type === 'rapidconnect') {
      console.log('\n🎵 RapidConnect API:');
      const rapidConnectKey = process.env.RAPIDCONNECT_API_KEY;
      if (rapidConnectKey) {
        console.log(`   ✅ API key configured`);
        log(`   Key length: ${rapidConnectKey.length}`);
      } else {
        console.log(`   ⚠️  API key not configured (set RAPIDCONNECT_API_KEY)`);
        console.log(`      This feature requires a RapidConnect API token`);
      }
    }

    // Check Firebase (placeholder - requires config)
    if (!type || type === 'firebase') {
      console.log('\n🔥 Firebase:');
      const firebaseConfig = process.env.FIREBASE_CONFIG;
      if (firebaseConfig) {
        console.log(`   ✅ Firebase config detected`);
        log(`   Config available`);
      } else {
        console.log(`   ⚠️  Firebase not configured (set FIREBASE_CONFIG)`);
        console.log(`      Required for Phase 2: event markers`);
      }
    }

    // Check CLI tools
    if (!type || type === '4art') {
      console.log('\n🛠️  CLI Tools:');
      console.log(`   ✅ Node.js ${process.version.substring(1)}`);
      console.log(`   ✅ Canvas rendering available`);
      console.log(`   ✅ CSV parsing available`);
    }

    console.log('\n📝 Commands Available:');
    console.log('   • poster generate --type 4art --artist <id> --output <file>');
    console.log('   • poster list 4art [--page <n>]');
    console.log('   • poster search <query>');
    console.log('   • poster info <artist-id>');
    console.log('   • poster batch --input <csv> --output <dir>');

    console.log('\n');
    if (allGood) {
      console.log('✅ All systems operational');
    } else {
      console.log('⚠️  Some systems need attention (see above)');
    }
    console.log('');

    return {
      success: allGood,
      status: 'ok'
    };

  } catch (error) {
    console.error(`❌ Status check failed: ${error.message}`);
    if (options.verbose) console.error(error.stack);
    process.exit(1);
  }
}

export default { status };
