module.exports = {
  apps: [
    {
      name: "guretxokoa",
      script: "dist/index.cjs",
      instances: "max", // Use all available CPU cores
      exec_mode: "cluster",
      env: {
        NODE_ENV: "development",
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      node_args: "--max-old-space-size=1024",
    },
    {
      name: "guretxokoa-staging",
      script: "dist/index.cjs",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "staging",
        PORT: 5001,
      },
      error_file: "./logs/err-staging.log",
      out_file: "./logs/out-staging.log",
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
    },
  ],
};
