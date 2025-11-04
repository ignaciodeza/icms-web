// Configuration
const API_URL = 'https://icms-classifier-1097431119255.europe-west2.run.app';
const MAX_CSV_ROWS = 100;

let csvData = null;
let classifiedData = null;

// Tab switching
function switchTab(tabName) {
    // Hide all tabs
    document.getElementById('content-demo').classList.add('hidden');
    document.getElementById('content-batch').classList.add('hidden');
    document.getElementById('content-about').classList.add('hidden');
    
    // Remove active class from all tabs
    document.getElementById('tab-demo').classList.remove('tab-active');
    document.getElementById('tab-batch').classList.remove('tab-active');
    document.getElementById('tab-about').classList.remove('tab-active');
    
    // Show selected tab
    document.getElementById('content-' + tabName).classList.remove('hidden');
    document.getElementById('tab-' + tabName).classList.add('tab-active');
}

// Demo classification
async function classifyDemo() {
    const input = document.getElementById('demo-input').value.trim();
    
    if (!input) {
        showDemoError('Please enter a description to classify');
        return;
    }
    
    // Hide previous results/errors
    document.getElementById('demo-result').classList.add('hidden');
    document.getElementById('demo-error').classList.add('hidden');
    
    // Show loading
    document.getElementById('demo-loading').classList.remove('hidden');
    document.getElementById('demo-button').disabled = true;
    
    const loadingText = document.querySelector('#demo-loading p');
    loadingText.textContent = 'Classifying...';
    
    // Add note about cold start after 2 seconds
    const coldStartTimer = setTimeout(() => {
        loadingText.textContent = '';
    }, 2000);
    
    try {
        const response = await fetch(`${API_URL}/icms/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: input })
        });
        
        if (!response.ok) {
            throw new Error('Classification failed');
        }
        
        const data = await response.json();
        
        if (data.classification && data.classification.length > 0) {
            const result = data.classification[0];
            
            // Display results
            document.getElementById('result-code').textContent = result.ICMS;
            document.getElementById('result-desc2').textContent = result.Desc2;
            document.getElementById('result-desc3').textContent = result.Desc3;
            document.getElementById('result-desc4').textContent = result.Desc4;
            
            document.getElementById('demo-result').classList.remove('hidden');
        } else {
            throw new Error('No classification returned');
        }
        
    } catch (error) {
        showDemoError('Failed to classify item. Please try again.');
        console.error('Demo classification error:', error);
    } finally {
        clearTimeout(coldStartTimer);
        document.getElementById('demo-loading').classList.add('hidden');
        document.getElementById('demo-button').disabled = false;
    }
}

function showDemoError(message) {
    document.getElementById('demo-error-message').textContent = message;
    document.getElementById('demo-error').classList.remove('hidden');
}

// CSV File handling
function handleFileSelect(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
        showBatchError('Invalid file type. Please upload a CSV file.');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            csvData = parseCSV(e.target.result);
            
            // Check if first row is header
            const firstRow = csvData[0];
            const firstCell = firstRow[0].toLowerCase();
            const isHeader = firstCell.includes('description') || 
                           firstCell.includes('item') || 
                           firstCell.includes('name') ||
                           firstCell.includes('text');
            
            // If header row detected, remove it
            if (isHeader) {
                csvData.shift();
            }
            
            // Validate CSV
            if (csvData.length === 0) {
                throw new Error('CSV file is empty');
            }
            
            if (csvData.length > MAX_CSV_ROWS) {
                throw new Error(`CSV file contains ${csvData.length} rows. Maximum allowed is ${MAX_CSV_ROWS} rows.`);
            }
            
            // Check if first column has text
            const hasText = csvData.some(row => row[0] && row[0].trim().length > 0);
            if (!hasText) {
                throw new Error('First column appears to be empty. Please ensure descriptions are in the first column.');
            }
            
            // Show file info
            document.getElementById('file-name').textContent = file.name;
            document.getElementById('file-details').textContent = `${csvData.length} rows, ${csvData[0].length} columns`;
            document.getElementById('file-info').classList.remove('hidden');
            document.getElementById('batch-button').disabled = false;
            document.getElementById('batch-error').classList.add('hidden');
            
        } catch (error) {
            showBatchError(error.message);
            clearFile();
        }
    };
    
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
        // Simple CSV parser - handles quoted fields
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        
        return result;
    });
}

function clearFile() {
    csvData = null;
    classifiedData = null;
    document.getElementById('csv-input').value = '';
    document.getElementById('file-info').classList.add('hidden');
    document.getElementById('batch-button').disabled = true;
    document.getElementById('batch-result').classList.add('hidden');
}

// Batch classification
async function classifyBatch() {
    if (!csvData) return;
    
    // Hide previous results/errors
    document.getElementById('batch-result').classList.add('hidden');
    document.getElementById('batch-error').classList.add('hidden');
    
    // Show loading
    document.getElementById('batch-loading').classList.remove('hidden');
    document.getElementById('batch-button').disabled = true;
    
    const loadingText = document.querySelector('#batch-loading p');
    loadingText.textContent = 'Processing CSV...';
    
    // Add note about cold start after 2 seconds
    const coldStartTimer = setTimeout(() => {
        loadingText.textContent = 'First request may take a few seconds as the service initialises...';
    }, 2000);
    
    try {
        // Extract descriptions from first column
        const descriptions = csvData.map(row => row[0]);
        
        const response = await fetch(`${API_URL}/icms/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: descriptions })
        });
        
        if (!response.ok) {
            throw new Error('Classification failed');
        }
        
        const data = await response.json();
        
        if (data.classification && data.classification.length > 0) {
            // Merge original CSV data with classification results
            classifiedData = csvData.map((row, index) => {
                const classification = data.classification[index];
                return [
                    ...row,
                    classification.ICMS,
                    classification.Desc2,
                    classification.Desc3,
                    classification.Desc4
                ];
            });
            
            // Show results
            document.getElementById('batch-count').textContent = classifiedData.length;
            displayPreview();
            document.getElementById('batch-result').classList.remove('hidden');
        } else {
            throw new Error('No classifications returned');
        }
        
    } catch (error) {
        showBatchError('Failed to classify CSV. Please check your file and try again.');
        console.error('Batch classification error:', error);
    } finally {
        clearTimeout(coldStartTimer);
        document.getElementById('batch-loading').classList.add('hidden');
        document.getElementById('batch-button').disabled = false;
    }
}

function displayPreview() {
    const previewDiv = document.getElementById('preview-table');
    const previewRows = classifiedData.slice(0, 10);
    
    let html = '<table class="min-w-full divide-y divide-gray-200 text-sm">';
    html += '<thead class="bg-gray-100"><tr>';
    
    // Header row
    const numOriginalCols = csvData[0].length;
    for (let i = 0; i < numOriginalCols; i++) {
        html += `<th class="px-3 py-2 text-left font-medium text-gray-700">Column ${i + 1}</th>`;
    }
    html += '<th class="px-3 py-2 text-left font-medium text-gray-700">ICMS Code</th>';
    html += '<th class="px-3 py-2 text-left font-medium text-gray-700">Level 2</th>';
    html += '<th class="px-3 py-2 text-left font-medium text-gray-700">Level 3</th>';
    html += '<th class="px-3 py-2 text-left font-medium text-gray-700">Level 4</th>';
    html += '</tr></thead>';
    
    html += '<tbody class="bg-white divide-y divide-gray-200">';
    previewRows.forEach(row => {
        html += '<tr>';
        row.forEach((cell, idx) => {
            const isICMSCol = idx >= numOriginalCols;
            const cellClass = isICMSCol ? 'bg-green-50 font-medium' : '';
            const truncated = cell.length > 50 ? cell.substring(0, 47) + '...' : cell;
            html += `<td class="px-3 py-2 ${cellClass}">${escapeHtml(truncated)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    
    previewDiv.innerHTML = html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function downloadResults() {
    if (!classifiedData) return;
    
    // Convert to CSV
    const csvContent = classifiedData.map(row => {
        return row.map(cell => {
            // Escape quotes and wrap in quotes if contains comma
            const escaped = String(cell).replace(/"/g, '""');
            return escaped.includes(',') || escaped.includes('\n') ? `"${escaped}"` : escaped;
        }).join(',');
    }).join('\n');
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'classified_' + new Date().getTime() + '.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showBatchError(message) {
    document.getElementById('batch-error-message').textContent = message;
    document.getElementById('batch-error').classList.remove('hidden');
}

// Allow enter key for demo
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('demo-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            classifyDemo();
        }
    });
    
    // Add drag and drop functionality
    const dropZone = document.getElementById('drop-zone');
    
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('border-blue-500', 'bg-blue-50');
        });
        
        dropZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-blue-500', 'bg-blue-50');
        });
        
        dropZone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('border-blue-500', 'bg-blue-50');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                // Simulate file input change
                const input = document.getElementById('csv-input');
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                input.files = dataTransfer.files;
                
                // Trigger the change event
                const event = new Event('change', { bubbles: true });
                input.dispatchEvent(event);
            }
        });
    }
    
    // Auto-run classification on page load to warm up the service
    // Small delay to let the page render first
    setTimeout(() => {
        classifyDemo();
    }, 500);
});
