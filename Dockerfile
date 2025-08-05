# Use an official Node.js image as base
FROM node:18

# Create and set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Install backend dependencies
RUN npm install

# Copy the rest of your application code
COPY . .

# Expose the port your app runs on (e.g., Express on 3000)
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]
