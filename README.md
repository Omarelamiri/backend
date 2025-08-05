# npm install
npm install express sequelize pg bcryptjs jsonwebtoken dotenv winston winston-daily-rotate-file express-winston
npm install --save-dev nodemon

# gitignore
Add-Content .gitignore "node_modules"
Add-Content .gitignore ".env"
Add-Content .gitignore "logs/"

# After in change rebuild backend image in docker
docker-compose up --build
docker-compose restart (If you just updated .js files (no new dependencies or Dockerfile changes))

# connect to a PostgreSQL database running inside a Docker container
docker exec -it postgres-db psql -U postgres -d saasdb
#   list tables in the database
    \dt
#   list columns of a table
    \d "table_name"
#   Quit
    \q