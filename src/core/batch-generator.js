import { generate } from './4art-generator.js';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

/**
 * Batch generate posters from CSV file
 * 
 * CSV format:
 * artist_id,output_path
 * bruno-mars,./posters/bruno-mars.png
 * j-balvin,./posters/j-balvin.png
 * 
 * Options:
 * - input: path to CSV file (required)
 * - output: output directory (default ./)
 * - type: poster type (default '4art')
 * - concurrent: number of concurrent generations (default 4)
 * - verbose: detailed logging
 */
export async function batch(options = {}) {
  const {
    input,
    output = './',
    type = '4art',
    concurrent = 4,
    verbose = false
  } = options;

  const log = (msg) => {
    if (verbose) console.log(`[batch-generator] ${msg}`);
  };

  try {
    if (!input || !fs.existsSync(input)) {
      throw new Error(`Input CSV file not found: ${input}`);
    }

    log(`Reading CSV file: ${input}`);
    const csvContent = fs.readFileSync(input, 'utf8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });

    console.log(`📋 Batch generation for ${records.length} artists\n`);

    if (records.length === 0) {
      console.log('⚠️  No records found in CSV');
      return { success: false, processed: 0, failed: 0 };
    }

    // Validate records
    const validRecords = records.filter(record => {
      if (!record.artist_id) {
        console.error(`⚠️  Skipping row with missing artist_id`);
        return false;
      }
      return true;
    });

    log(`${validRecords.length} valid records to process`);

    // Process in batches
    let processed = 0;
    let failed = 0;
    const results = [];

    for (let i = 0; i < validRecords.length; i += concurrent) {
      const batch = validRecords.slice(i, i + concurrent);
      
      log(`Processing batch ${Math.ceil((i + 1) / concurrent)} of ${Math.ceil(validRecords.length / concurrent)}`);

      const promises = batch.map(async (record) => {
        try {
          const outputPath = record.output_path || path.join(output, `${record.artist_id}.png`);
          
          log(`Generating poster for: ${record.artist_id} -> ${outputPath}`);
          
          await generate({
            artistId: record.artist_id,
            output: outputPath,
            format: 'png',
            verbose: false
          });

          processed++;
          console.log(`✅ ${record.artist_id} -> ${outputPath}`);
          
          return {
            artist_id: record.artist_id,
            output: outputPath,
            success: true
          };
        } catch (error) {
          failed++;
          console.error(`❌ ${record.artist_id}: ${error.message}`);
          
          return {
            artist_id: record.artist_id,
            error: error.message,
            success: false
          };
        }
      });

      results.push(...await Promise.all(promises));
    }

    console.log(`\n✅ Batch generation complete!`);
    console.log(`   Processed: ${processed} ✓`);
    console.log(`   Failed: ${failed} ✗`);
    console.log(`   Total: ${processed + failed}`);

    return {
      success: failed === 0,
      processed,
      failed,
      total: validRecords.length,
      results
    };

  } catch (error) {
    console.error(`❌ Batch generation failed: ${error.message}`);
    if (options.verbose) console.error(error.stack);
    process.exit(1);
  }
}

export default { batch };
