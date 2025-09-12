// Test script to fetch available SKUs from Discord
import { API_ENDPOINTS } from './config.js';

/**
 * Fetch and display available SKUs from Discord
 */
async function testAvailableSKUs() {
    try {
        console.log('🔍 Fetching available SKUs from Discord...');
        
        const response = await fetch(API_ENDPOINTS.availableSKUs, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const result = await response.json();
        
        if (result.success) {
            console.log(`✅ Found ${result.count} available SKUs:`);
            console.log('📦 Available SKUs:', result.skus);
            
            // Display each SKU in a readable format
            result.skus.forEach((sku, index) => {
                console.log(`\n${index + 1}. SKU Details:`);
                console.log(`   ID: ${sku.id}`);
                console.log(`   Name: ${sku.name}`);
                console.log(`   Type: ${sku.type} (${getSKUTypeName(sku.type)})`);
                console.log(`   Price: ${sku.price ? `${sku.price.amount} ${sku.price.currency}` : 'Free'}`);
                console.log(`   Flags: ${sku.flags || 'None'}`);
                if (sku.application_id) {
                    console.log(`   Application ID: ${sku.application_id}`);
                }
            });
            
            // Check if our expected SKU exists
            const expectedSKU = result.skus.find(sku => sku.id === '10_gems');
            if (expectedSKU) {
                console.log('\n✅ Found expected SKU "10_gems"!');
            } else {
                console.log('\n❌ Expected SKU "10_gems" not found.');
                console.log('Available SKU IDs:', result.skus.map(sku => sku.id));
            }
            
        } else {
            console.error('❌ Failed to fetch SKUs:', result.error);
        }
        
    } catch (error) {
        console.error('❌ Error fetching SKUs:', error);
    }
}

/**
 * Get human-readable SKU type name
 * @param {number} type - SKU type number
 * @returns {string} Type name
 */
function getSKUTypeName(type) {
    const types = {
        2: 'Durable',
        5: 'Consumable',
        6: 'Bundle'
    };
    return types[type] || `Unknown (${type})`;
}

// Make it available globally for testing
window.testAvailableSKUs = testAvailableSKUs;

// Auto-run if this script is loaded
if (typeof window !== 'undefined') {
    console.log('🚀 SKU test script loaded. Run testAvailableSKUs() to fetch available SKUs.');
}
