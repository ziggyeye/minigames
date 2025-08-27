FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json .npmrc ./

# Set npm registry to public
RUN npm config set registry https://registry.npmjs.org/

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
