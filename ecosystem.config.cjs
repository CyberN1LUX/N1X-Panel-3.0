module.exports = {
  apps: [
    {
      name: "n1x-panel",
      script: "npm",
      args: "start",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
        DEFAULT_RUNTIME: "local",
        ENABLE_DOCKER: "false"
      }
    },
    {
      name: "n1x-dev",
      script: "npm",
      args: "run dev",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        DEFAULT_RUNTIME: "local",
        ENABLE_DOCKER: "false"
      }
    }
  ]
};
