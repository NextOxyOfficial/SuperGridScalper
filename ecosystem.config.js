module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: '/var/www/markstrades/backend',
      script: '/var/www/markstrades/backend/venv/bin/gunicorn',
      args: 'config.wsgi:application --bind 127.0.0.1:8000 --workers 3 --timeout 300',
      interpreter: 'none',
      env: {
        DJANGO_SETTINGS_MODULE: 'config.settings',
      },
      watch: false,
      max_memory_restart: '500M',
      error_file: '/var/www/markstrades/logs/backend-error.log',
      out_file: '/var/www/markstrades/logs/backend-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'frontend',
      cwd: '/var/www/markstrades/frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
      },
      watch: false,
      max_memory_restart: '500M',
      error_file: '/var/www/markstrades/logs/frontend-error.log',
      out_file: '/var/www/markstrades/logs/frontend-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
