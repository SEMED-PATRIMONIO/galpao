module.exports = {
  apps: [
    {
      name: "backend-formacao",
      script: "./backend/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3009,
        DATABASE_URL: "postgresql://postgres:Gatosap2009*2@localhost:5432/postgres"
      }
    },
    {
      name: "app-professor",
      script: "serve",
      env: {
        PM2_SERVE_PATH: './app-professor/dist',
        PM2_SERVE_PORT: 3033,
        PM2_SERVE_SPA: 'true'
      }
    },
    {
      name: "app-admin",
      script: "serve",
      env: {
        PM2_SERVE_PATH: './app-admin/dist',
        PM2_SERVE_PORT: 3034,
        PM2_SERVE_SPA: 'true'
      }
    }
  ]
};