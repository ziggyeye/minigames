#!/bin/bash

# Remove existing node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Set npm to use public registry
npm config set registry https://registry.npmjs.org/

# Install dependencies to generate new package-lock.json
npm install

echo "Package-lock.json regenerated with public npm registry"
