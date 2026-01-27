const { defineConfig } = require('cypress');
const fs = require('fs');
const path = require('path');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3003/resturant-website',
    supportFile: 'cypress/support/e2e.js',
    video: false,
    setupNodeEvents(on) {
      on('task', {
        'db:reset'() {
          const projectRoot = __dirname;
          const dbPath = process.env.DB_FILE_PATH
            ? path.resolve(process.env.DB_FILE_PATH)
            : path.join(projectRoot, 'database.json');

          const seedPath = process.env.TEST_DB_SEED_PATH
            ? path.resolve(process.env.TEST_DB_SEED_PATH)
            : path.join(projectRoot, 'cypress', 'fixtures', 'database.seed.json');

          fs.mkdirSync(path.dirname(dbPath), { recursive: true });
          fs.copyFileSync(seedPath, dbPath);
          return null;
        }
      });
    }
  }
});
