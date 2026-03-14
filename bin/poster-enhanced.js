#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Canvas } from 'canvas';
import axios from 'axios';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { artisticThemes } from '../src/core/artistic-themes.js';
import { EnhancedFourartGenerator } from '../src/core/4art-enhanced-generator.js';
import { generate as generateBasic } from '../src/core/4art-generator.js';

// ===== ENHANCED GENERATE COMMAND =====
const generateCmd = {
  command: 'generate',
  describe: 'Generate a poster (basic or enhanced)',
  builder: (y) =>
    y
      .option('type', { alias: 't', describe: 'Poster type', choices: ['4art'], default: '4art', type: 'string' })
      .option('artist', { alias: 'a', describe: 'Artist ID', type: 'string', demandOption: true })
      .option('output', { alias: 'o', describe: 'Output file path', type: 'string', demandOption: true })
      .option('format', { describe: 'Output format', choices: ['png', 'json', 'svg', 'pdf'], default: 'png', type: 'string' })
      .option('width', { describe: 'Image width', type: 'number', default: 1920 })
      .option('height', { describe: 'Image height', type: 'number', default: 1080 })
      .option('theme', { describe: '32 artistic themes available', type: 'string', default: 'ancient_woodland' })
      .option('enhanced', { describe: 'Use enhanced features', type: 'boolean', default: false })
      .option('show-legend', { describe: 'Add legend to poster', type: 'boolean', default: true })
      .option('show-routes', { describe: 'Show routes between locations', type: 'boolean', default: false })
      .option('include-venues', { describe: 'Include venue markers', type: 'boolean', default: false })
      .option('include-events', { describe: 'Include event markers', type: 'boolean', default: false })
      .option('quality', { describe: 'Quality level', choices: ['low', 'medium', 'high'], default: 'high' })
      .option('list-themes', { describe: 'List all available themes', type: 'boolean', default: false })
      .example('poster generate --artist bruno-mars --output poster.png', 'Generate basic 4art poster')
      .example('poster generate --artist bruno-mars --output poster.png --theme solar_flare --show-routes', 'Generate with theme and routes')
      .example('poster generate --artist bruno-mars --output poster.png --enhanced --include-venues --include-events', 'Generate with all features'),
  handler: async (argv) => {
    try {
      // List themes if requested
      if (argv['list-themes']) {
        const themes = EnhancedFourartGenerator.getAvailableThemes();
        console.log('\n🎨 Available Themes (32 total):\n');
        themes.forEach((t, i) => {
          console.log(`${i + 1}. ${t.id}`);
          console.log(`   ${t.name}: ${t.description}`);
        });
        return;
      }

      // Use enhanced generator if requested or if any enhanced flags are set
      const useEnhanced = argv.enhanced || 
                         argv['show-routes'] || 
                         argv['include-venues'] || 
                         argv['include-events'] ||
                         argv.theme !== 'ancient_woodland';

      if (useEnhanced) {
        const generator = new EnhancedFourartGenerator({
          width: argv.width,
          height: argv.height,
          format: argv.format,
          theme: argv.theme,
          showLegend: argv['show-legend'],
          showRoutes: argv['show-routes'],
          includeVenues: argv['include-venues'],
          includeEvents: argv['include-events'],
          qualityLevel: argv.quality
        });

        const result = await generator.generate(argv.artist);
        
        // Write output
        if (argv.format === 'json') {
          fs.writeFileSync(argv.output, result);
        } else {
          fs.writeFileSync(argv.output, result);
        }

        console.log(`✅ Poster saved to ${argv.output}`);
      } else {
        // Use basic generator for simple case
        await generateBasic({
          artistId: argv.artist,
          output: argv.output,
          width: argv.width,
          height: argv.height,
          format: argv.format,
          verbose: argv.verbose
        });
      }
    } catch (error) {
      console.error('❌ Generation failed:', error.message);
      if (argv.verbose) console.error(error.stack);
      process.exit(1);
    }
  }
};

// ===== THEMES COMMAND =====
const themesCmd = {
  command: 'themes',
  describe: 'List and manage poster themes',
  builder: (y) =>
    y
      .option('list', { alias: 'l', describe: 'List all themes', type: 'boolean' })
      .option('details', { alias: 'd', describe: 'Show theme details', type: 'string' })
      .example('poster themes --list', 'Show all 32 available themes')
      .example('poster themes --details solar_flare', 'Show details for a theme'),
  handler: async (argv) => {
    try {
      if (argv.list) {
        const themes = EnhancedFourartGenerator.getAvailableThemes();
        console.log('\n🎨 Available Artistic Themes (32 total)\n');
        themes.forEach((t, i) => {
          console.log(`${(i + 1).toString().padStart(2)}. ${t.id.padEnd(25)} - ${t.name}`);
          console.log(`    ${t.description}`);
        });
      } else if (argv.details) {
        const themes = EnhancedFourartGenerator.getAvailableThemes();
        const theme = themes.find(t => t.id === argv.details);
        if (theme) {
          console.log(`\n📋 Theme: ${theme.name}`);
          console.log(`   ID: ${theme.id}`);
          console.log(`   ${theme.description}\n`);
        } else {
          console.error(`❌ Theme not found: ${argv.details}`);
        }
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
};

// ===== CONFIG COMMAND =====
const configCmd = {
  command: 'config',
  describe: 'Manage poster configurations',
  builder: (y) =>
    y
      .option('save', { alias: 's', describe: 'Save current config to file', type: 'string' })
      .option('load', { alias: 'l', describe: 'Load config from file', type: 'string' })
      .example('poster config --save my-config.json', 'Save configuration'),
  handler: async (argv) => {
    try {
      if (argv.save) {
        const generator = new EnhancedFourartGenerator();
        generator.saveConfig(argv.save);
      } else if (argv.load) {
        const generator = await EnhancedFourartGenerator.loadConfig(argv.load);
        console.log('✅ Config loaded:', argv.load);
      }
    } catch (error) {
      console.error('❌ Config error:', error.message);
      process.exit(1);
    }
  }
};

// ===== LIST COMMAND (ENHANCED) =====
const listCmd = {
  command: 'list <type>',
  describe: 'List artists, themes, or features',
  builder: (y) =>
    y
      .option('page', { describe: 'Page number', type: 'number', default: 1 })
      .option('limit', { describe: 'Results per page', type: 'number', default: 5 })
      .option('format', { alias: 'f', describe: 'Output format', choices: ['table', 'json', 'csv'], default: 'table' })
      .example('poster list 4art --limit 10', 'List 10 artists')
      .example('poster list themes', 'List all themes'),
  handler: async (argv) => {
    try {
      if (argv.type === 'themes') {
        const themes = EnhancedFourartGenerator.getAvailableThemes();
        console.log(`\n📊 Total themes available: ${themes.length}`);
        themes.slice(0, 10).forEach(t => {
          console.log(`  • ${t.id} - ${t.name}`);
        });
      } else {
        const { list } = await import('../src/core/4art-list.js');
        await list(argv);
      }
    } catch (error) {
      console.error('❌ List error:', error.message);
      process.exit(1);
    }
  }
};

// ===== SEARCH COMMAND =====
const searchCmd = {
  command: 'search <query>',
  describe: 'Search artists by name',
  builder: (y) =>
    y
      .option('limit', { describe: 'Number of results', type: 'number', default: 10 })
      .example('poster search "bruno mars"', 'Find artists matching query'),
  handler: async (argv) => {
    try {
      const { search } = await import('../src/core/4art-search.js');
      await search(argv);
    } catch (error) {
      console.error('❌ Search error:', error.message);
      process.exit(1);
    }
  }
};

// ===== INFO COMMAND =====
const infoCmd = {
  command: 'info <artist-id>',
  describe: 'Get artist information',
  handler: async (argv) => {
    try {
      const { info } = await import('../src/core/4art-info.js');
      await info(argv);
    } catch (error) {
      console.error('❌ Info error:', error.message);
      process.exit(1);
    }
  }
};

// ===== BATCH COMMAND (ENHANCED) =====
const batchCmd = {
  command: 'batch',
  describe: 'Generate multiple posters from CSV',
  builder: (y) =>
    y
      .option('input', { alias: 'i', describe: 'CSV file with artist IDs', type: 'string', demandOption: true })
      .option('output', { alias: 'o', describe: 'Output directory', type: 'string', demandOption: true })
      .option('format', { describe: 'Output format', choices: ['png', 'json', 'svg', 'pdf'], default: 'png' })
      .option('theme', { describe: 'Theme for all posters', type: 'string', default: 'ancient_woodland' })
      .option('concurrent', { describe: 'Number of concurrent workers', type: 'number', default: 4 })
      .option('enhanced', { describe: 'Use enhanced features', type: 'boolean', default: false })
      .example('poster batch --input artists.csv --output ./posters/', 'Generate batch of posters'),
  handler: async (argv) => {
    try {
      const { batch } = await import('../src/core/batch-generator.js');
      await batch({
        ...argv,
        enhanced: argv.enhanced
      });
    } catch (error) {
      console.error('❌ Batch error:', error.message);
      process.exit(1);
    }
  }
};

// ===== STATUS COMMAND (ENHANCED) =====
const statusCmd = {
  command: 'status [type]',
  describe: 'Check system status and features',
  handler: async (argv) => {
    try {
      const { status } = await import('../src/core/status.js');
      console.log('\n🔍 Enhanced 4art CLI Status\n');
      console.log('📊 Feature Support:');
      console.log('   ✓ 32 Artistic Themes');
      console.log('   ✓ Advanced Marker Styling');
      console.log('   ✓ Route Visualization');
      console.log('   ✓ Multi-format Export (PNG, JSON, SVG, PDF)');
      console.log('   ✓ Venue Markers');
      console.log('   ✓ Event Integration');
      console.log('   ✓ Legend Generation');
      console.log('   ✓ Collision Detection');
      console.log('   ✓ Config Persistence\n');
      
      await status(argv);
    } catch (error) {
      console.error('❌ Status error:', error.message);
      process.exit(1);
    }
  }
};

// ===== VERSION & HELP =====
const versionCmd = {
  command: 'version',
  describe: 'Show version',
  handler: () => {
    console.log('4art-poster v2.0.0 (Enhanced)');
    console.log('All map-to-poster features integrated');
  }
};

// ===== MAIN CLI =====
const cli = yargs(hideBin(process.argv))
  .command(generateCmd)
  .command(themesCmd)
  .command(configCmd)
  .command(listCmd)
  .command(searchCmd)
  .command(infoCmd)
  .command(batchCmd)
  .command(statusCmd)
  .command(versionCmd)
  .option('verbose', { alias: 'v', describe: 'Verbose output', type: 'boolean' })
  .option('quiet', { alias: 'q', describe: 'Quiet output', type: 'boolean' })
  .help()
  .alias('help', 'h')
  .version(false);

cli.parseAsync().catch(error => {
  console.error('❌ CLI Error:', error.message);
  process.exit(1);
});
