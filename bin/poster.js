#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Commands
const generateCmd = {
  command: 'generate',
  describe: 'Generate a poster',
  builder: (y) =>
    y
      .option('artist', { alias: 'a', describe: 'Artist ID', type: 'string', demandOption: true })
      .option('data', { alias: 'd', describe: 'Path to JSON data file', type: 'string' })
      .option('output', { alias: 'o', describe: 'Output file path', type: 'string', demandOption: true })
      .option('format', { describe: 'Output format: png or json', choices: ['png', 'json'], default: 'png', type: 'string' })
      .option('width', { describe: 'Image width (default: 1200)', type: 'number', default: 1200 })
      .option('height', { describe: 'Image height (default: 800)', type: 'number', default: 800 })
      .option('zoom', { alias: 'z', describe: 'Map zoom level (default: 12)', type: 'number' })
      .example('poster generate --artist bruno-mars --output poster.png', 'Generate 4art poster for artist'),
  handler: async (argv) => {
    try {
      const { generate } = await import('../src/core/4art-generator.js');
      await generate({
        artistId: argv.artist,
        data: argv.data,
        output: argv.output,
        width: argv.width,
        height: argv.height,
        zoom: argv.zoom,
        format: argv.format,
        verbose: argv.verbose
      });
    } catch (error) {
      console.error('❌ Generation failed:', error.message);
      if (argv.verbose) console.error(error.stack);
      process.exit(1);
    }
  }
};

const listCmd = {
  command: 'list <type>',
  describe: 'List available items',
  builder: (y) =>
    y
      .positional('type', { describe: 'List type: 4art (artists)', choices: ['4art'], type: 'string' })
      .option('format', { describe: 'Output format', choices: ['table', 'json', 'csv'], default: 'table', type: 'string' })
      .option('limit', { describe: 'Number of results', type: 'number', default: 20 })
      .option('page', { describe: 'Page number', type: 'number', default: 1 })
      .example('poster list 4art', 'List all 4art artists'),
  handler: async (argv) => {
    try {
      if (argv.type === '4art') {
        const { list } = await import('../src/core/4art-list.js');
        await list({
          format: argv.format,
          page: argv.page,
          perPage: argv.limit,
          verbose: argv.verbose
        });
      }
    } catch (error) {
      console.error('❌ List failed:', error.message);
      if (argv.verbose) console.error(error.stack);
      process.exit(1);
    }
  }
};

const searchCmd = {
  command: 'search <query>',
  describe: 'Search artists',
  builder: (y) =>
    y
      .positional('query', { describe: 'Search query (artist name)', type: 'string' })
      .option('limit', { describe: 'Max results', type: 'number', default: 10 })
      .option('format', { describe: 'Output format', choices: ['table', 'json'], default: 'table', type: 'string' })
      .example('poster search "bruno mars"', 'Search for Bruno Mars'),
  handler: async (argv) => {
    try {
      const { search } = await import('../src/core/4art-search.js');
      await search({
        query: argv.query,
        limit: argv.limit,
        format: argv.format,
        verbose: argv.verbose
      });
    } catch (error) {
      console.error('❌ Search failed:', error.message);
      if (argv.verbose) console.error(error.stack);
      process.exit(1);
    }
  }
};

const infoCmd = {
  command: 'info <artist-id>',
  describe: 'Get artist information',
  builder: (y) =>
    y
      .positional('artist-id', { describe: 'Artist ID', type: 'string' })
      .option('format', { describe: 'Output format', choices: ['table', 'json'], default: 'table', type: 'string' })
      .example('poster info bruno-mars-lamusica', 'Show artist info'),
  handler: async (argv) => {
    try {
      const { info } = await import('../src/core/4art-info.js');
      await info({
        artistId: argv['artist-id'],
        format: argv.format,
        verbose: argv.verbose
      });
    } catch (error) {
      console.error('❌ Info failed:', error.message);
      if (argv.verbose) console.error(error.stack);
      process.exit(1);
    }
  }
};

const batchCmd = {
  command: 'batch',
  describe: 'Generate multiple posters from CSV',
  builder: (y) =>
    y
      .option('input', { alias: 'i', describe: 'Input CSV file', type: 'string', demandOption: true })
      .option('output', { alias: 'o', describe: 'Output directory', type: 'string', default: './' })
      .option('concurrent', { describe: 'Concurrent generations', type: 'number', default: 4 })
      .example('poster batch --input artists.csv --output ./posters/', 'Generate batch'),
  handler: async (argv) => {
    try {
      const { batch } = await import('../src/core/batch-generator.js');
      await batch({
        input: argv.input,
        output: argv.output,
        concurrent: argv.concurrent,
        verbose: argv.verbose
      });
    } catch (error) {
      console.error('❌ Batch failed:', error.message);
      if (argv.verbose) console.error(error.stack);
      process.exit(1);
    }
  }
};

const statusCmd = {
  command: 'status [type]',
  describe: 'Check system status',
  builder: (y) =>
    y
      .positional('type', { describe: 'Check type: 4art, rapidconnect, firebase', type: 'string' })
      .example('poster status', 'Check all systems'),
  handler: async (argv) => {
    try {
      const { status: checkStatus } = await import('../src/core/status.js');
      await checkStatus({
        type: argv.type,
        verbose: argv.verbose
      });
    } catch (error) {
      console.error('❌ Status check failed:', error.message);
      if (argv.verbose) console.error(error.stack);
      process.exit(1);
    }
  }
};

// Main CLI
yargs(hideBin(process.argv))
  .command(generateCmd)
  .command(listCmd)
  .command(searchCmd)
  .command(infoCmd)
  .command(batchCmd)
  .command(statusCmd)
  .command('version', 'Show version', () => {}, () => console.log('poster v1.0.0'))
  .demandCommand(1, '❌ Please provide a command')
  .option('verbose', { alias: 'v', describe: 'Verbose output', type: 'boolean', global: true })
  .option('quiet', { alias: 'q', describe: 'Quiet output', type: 'boolean', global: true })
  .help()
  .alias('help', 'h')
  .strict()
  .parseAsync()
  .catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
  });
