document.addEventListener('DOMContentLoaded', function() {
    // Enhanced PDF Merger Application
    const app = {
        // DOM Elements
        elements: {
            // Mode selector
            modeBtns: document.querySelectorAll('.mode-btn'),
            mergeModes: document.querySelectorAll('.merge-mode'),
            
            // Simple mode
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            fileList: document.getElementById('fileList'),
            validateBtn: document.getElementById('validateBtn'),
            mergeBtn: document.getElementById('mergeBtn'),
            uploadForm: document.getElementById('uploadForm'),
            validationResults: document.getElementById('validationResults'),
            
            // Advanced mode
            advancedDropZone: document.getElementById('advancedDropZone'),
            advancedFileInput: document.getElementById('advancedFileInput'),
            advancedFileList: document.getElementById('advancedFileList'),
            advancedForm: document.getElementById('advancedForm'),
            mergeOptions: document.getElementById('mergeOptions'),
            mergeOptionsPanel: document.getElementById('mergeOptionsPanel'),
            previewBtn: document.getElementById('previewBtn'),
            advancedMergeBtn: document.getElementById('advancedMergeBtn'),
            customOrderCheckbox: document.getElementById('customOrder'),
            pageRangesCheckbox: document.getElementById('pageRanges'),
            
            // Bulk mode
            bulkGroups: document.getElementById('bulkGroups'),
            addGroupBtn: document.getElementById('addGroupBtn'),
            bulkMergeBtn: document.getElementById('bulkMergeBtn'),
            
            // Progress and status
            progressModal: document.getElementById('progressModal'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            statusMessages: document.getElementById('statusMessages')
        },
        
        // Application state
        state: {
            currentMode: 'simple',
            validatedFiles: [],
            bulkGroupCount: 1,
            isProcessing: false
        },
        
        // Initialize the application
        init() {
            this.setupEventListeners();
            this.setupDragAndDrop();
            console.log('Enhanced PDF Merger initialized');
        },
        
        // Setup event listeners
        setupEventListeners() {
            // Mode switching
            this.elements.modeBtns.forEach(btn => {
                btn.addEventListener('click', (e) => this.switchMode(e.target.dataset.mode));
            });
            
            // Simple mode events
            if (this.elements.dropZone) {
                this.elements.dropZone.addEventListener('click', () => this.elements.fileInput.click());
            }
            if (this.elements.fileInput) {
                this.elements.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files, 'simple'));
            }
            if (this.elements.validateBtn) {
                this.elements.validateBtn.addEventListener('click', () => this.validateFiles());
            }
            if (this.elements.uploadForm) {
                this.elements.uploadForm.addEventListener('submit', (e) => this.handleSubmit(e, 'simple'));
            }
            
            // Advanced mode events
            if (this.elements.advancedDropZone) {
                this.elements.advancedDropZone.addEventListener('click', () => this.elements.advancedFileInput.click());
            }
            if (this.elements.advancedFileInput) {
                this.elements.advancedFileInput.addEventListener('change', (e) => this.handleFiles(e.target.files, 'advanced'));
            }
            if (this.elements.advancedForm) {
                this.elements.advancedForm.addEventListener('submit', (e) => this.handleSubmit(e, 'advanced'));
            }
            if (this.elements.previewBtn) {
                this.elements.previewBtn.addEventListener('click', () => this.previewMerge());
            }
            if (this.elements.customOrderCheckbox) {
                this.elements.customOrderCheckbox.addEventListener('change', () => this.toggleCustomOrder());
            }
            if (this.elements.pageRangesCheckbox) {
                this.elements.pageRangesCheckbox.addEventListener('change', () => this.togglePageRanges());
            }
            
            // Bulk mode events
            if (this.elements.addGroupBtn) {
                this.elements.addGroupBtn.addEventListener('click', () => this.addBulkGroup());
            }
            if (this.elements.bulkMergeBtn) {
                this.elements.bulkMergeBtn.addEventListener('click', () => this.processBulkMerge());
            }
        },
        
        // Setup drag and drop functionality
        setupDragAndDrop() {
            const dropZones = [this.elements.dropZone, this.elements.advancedDropZone];
            
            dropZones.forEach(zone => {
                if (!zone) return;
                
                ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                    zone.addEventListener(eventName, this.preventDefaults, false);
                });
                
                ['dragenter', 'dragover'].forEach(eventName => {
                    zone.addEventListener(eventName, () => zone.classList.add('dragover'), false);
                });
                
                ['dragleave', 'drop'].forEach(eventName => {
                    zone.addEventListener(eventName, () => zone.classList.remove('dragover'), false);
                });
                
                zone.addEventListener('drop', (e) => {
                    const files = e.dataTransfer.files;
                    const mode = zone.id === 'dropZone' ? 'simple' : 'advanced';
                    this.handleFiles(files, mode);
                }, false);
            });
        },
        
        // Prevent default drag behaviors
        preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        },
        
        // Switch between modes
        switchMode(mode) {
            this.state.currentMode = mode;
            
            // Update mode buttons
            this.elements.modeBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });
            
            // Update mode panels
            this.elements.mergeModes.forEach(panel => {
                panel.classList.toggle('active', panel.id === `${mode}-mode`);
            });
            
            this.showStatus(`Switched to ${mode} mode`, 'info');
        },
        
        // Handle file selection
        handleFiles(files, mode) {
            const validFiles = Array.from(files).filter(file => {
                if (file.type !== 'application/pdf') {
                    this.showStatus(`Skipped ${file.name}: Only PDF files are allowed`, 'warning');
                    return false;
                }
                return true;
            });
            
            if (validFiles.length === 0) {
                this.showStatus('No valid PDF files selected', 'error');
                return;
            }
            
            if (mode === 'simple') {
                this.updateSimpleFileList(validFiles);
            } else if (mode === 'advanced') {
                this.updateAdvancedFileList(validFiles);
            }
            
            this.showStatus(`Added ${validFiles.length} PDF file(s)`, 'success');
        },
        
        // Update simple mode file list
        updateSimpleFileList(newFiles) {
            const dataTransfer = new DataTransfer();
            newFiles.forEach(file => dataTransfer.items.add(file));
            this.elements.fileInput.files = dataTransfer.files;
            
            this.elements.fileList.innerHTML = '';
            Array.from(this.elements.fileInput.files).forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'file-item';
                fileItem.innerHTML = `
                    <div class="file-info">
                        <div class="filename">${file.name}</div>
                        <div class="file-details">${this.formatFileSize(file.size)}</div>
                    </div>
                    <button type="button" class="remove-file" data-index="${index}">&times;</button>
                `;
                this.elements.fileList.appendChild(fileItem);
            });
            
            // Add remove functionality
            this.elements.fileList.querySelectorAll('.remove-file').forEach(btn => {
                btn.addEventListener('click', (e) => this.removeFile(parseInt(e.target.dataset.index), 'simple'));
            });
            
            this.updateButtons('simple');
        },
        
        // Update advanced mode file list
        updateAdvancedFileList(newFiles) {
            const dataTransfer = new DataTransfer();
            newFiles.forEach(file => dataTransfer.items.add(file));
            this.elements.advancedFileInput.files = dataTransfer.files;
            
            this.elements.advancedFileList.innerHTML = '';
            Array.from(this.elements.advancedFileInput.files).forEach((file, index) => {
                const fileItem = document.createElement('div');
                fileItem.className = 'advanced-file-item';
                fileItem.innerHTML = `
                    <div class="file-info">
                        <div class="filename">${file.name}</div>
                        <div class="file-details">${this.formatFileSize(file.size)} • Analyzing...</div>
                    </div>
                    <div class="file-controls">
                        <input type="number" class="order-input" value="${index + 1}" min="1" data-file="${file.name}">
                        <button type="button" class="remove-file" data-index="${index}">&times;</button>
                    </div>
                `;
                this.elements.advancedFileList.appendChild(fileItem);
                
                // Analyze file asynchronously
                this.analyzeFile(file, fileItem);
            });
            
            // Add remove functionality
            this.elements.advancedFileList.querySelectorAll('.remove-file').forEach(btn => {
                btn.addEventListener('click', (e) => this.removeFile(parseInt(e.target.dataset.index), 'advanced'));
            });
            
            // Show merge options if files are present
            if (this.elements.advancedFileInput.files.length > 0) {
                this.elements.mergeOptionsPanel.style.display = 'block';
            }
            
            this.updateButtons('advanced');
        },
        
        // Analyze file (simulate PDF analysis)
        async analyzeFile(file, fileItem) {
            try {
                // Simulate analysis delay
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Update file details (simulated)
                const pages = Math.floor(Math.random() * 50) + 1; // Random page count for demo
                const detailsElement = fileItem.querySelector('.file-details');
                detailsElement.textContent = `${this.formatFileSize(file.size)} • ${pages} pages`;
            } catch (error) {
                const detailsElement = fileItem.querySelector('.file-details');
                detailsElement.textContent = `${this.formatFileSize(file.size)} • Analysis failed`;
            }
        },
        
        // Remove file from list
        removeFile(index, mode) {
            const fileInput = mode === 'simple' ? this.elements.fileInput : this.elements.advancedFileInput;
            const dataTransfer = new DataTransfer();
            
            Array.from(fileInput.files).forEach((file, i) => {
                if (i !== index) {
                    dataTransfer.items.add(file);
                }
            });
            
            fileInput.files = dataTransfer.files;
            
            if (mode === 'simple') {
                this.updateSimpleFileList(Array.from(fileInput.files));
            } else {
                this.updateAdvancedFileList(Array.from(fileInput.files));
            }
        },
        
        // Update button states
        updateButtons(mode) {
            if (mode === 'simple') {
                const fileCount = this.elements.fileInput.files.length;
                this.elements.validateBtn.disabled = fileCount < 2;
                this.elements.mergeBtn.disabled = fileCount < 2;
            } else if (mode === 'advanced') {
                const fileCount = this.elements.advancedFileInput.files.length;
                this.elements.previewBtn.disabled = fileCount < 2;
                this.elements.advancedMergeBtn.disabled = fileCount < 2;
            }
        },
        
        // Validate files before merging
        async validateFiles() {
            if (this.state.isProcessing) return;
            
            this.state.isProcessing = true;
            this.showProgress('Validating files...');
            
            try {
                const formData = new FormData();
                Array.from(this.elements.fileInput.files).forEach(file => {
                    formData.append('files[]', file);
                });
                
                const response = await fetch('/validate', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    this.displayValidationResults(result);
                    this.showStatus('Files validated successfully', 'success');
                } else {
                    throw new Error(result.error || 'Validation failed');
                }
            } catch (error) {
                this.showStatus(`Validation error: ${error.message}`, 'error');
            } finally {
                this.hideProgress();
                this.state.isProcessing = false;
            }
        },
        
        // Display validation results
        displayValidationResults(result) {
            this.elements.validationResults.innerHTML = `
                <h3>✅ Validation Results</h3>
                <div class="file-summary">
                    <div class="summary-item">
                        <div class="number">${result.total_files}</div>
                        <div>Files</div>
                    </div>
                    <div class="summary-item">
                        <div class="number">${result.total_pages}</div>
                        <div>Pages</div>
                    </div>
                    <div class="summary-item">
                        <div class="number">${this.formatFileSize(result.files.reduce((sum, f) => sum + f.size, 0))}</div>
                        <div>Total Size</div>
                    </div>
                </div>
                <div class="file-details">
                    ${result.files.map(file => `
                        <div class="file-detail-item">
                            <strong>${file.name}</strong>: ${file.pages} pages, ${this.formatFileSize(file.size)}
                        </div>
                    `).join('')}
                </div>
            `;
            this.elements.validationResults.style.display = 'block';
        },
        
        // Handle form submission
        async handleSubmit(e, mode) {
            e.preventDefault();
            
            if (this.state.isProcessing) return;
            
            const fileInput = mode === 'simple' ? this.elements.fileInput : this.elements.advancedFileInput;
            const form = mode === 'simple' ? this.elements.uploadForm : this.elements.advancedForm;
            
            if (fileInput.files.length < 2) {
                this.showStatus('Please select at least 2 PDF files to merge', 'error');
                return;
            }
            
            this.state.isProcessing = true;
            this.showProgress('Merging PDFs...');
            
            try {
                const formData = new FormData(form);
                
                // Add merge options for advanced mode
                if (mode === 'advanced') {
                    const options = this.collectMergeOptions();
                    formData.set('options', JSON.stringify(options));
                }
                
                const response = await fetch(form.action, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    // Handle file download
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = mode === 'simple' ? 'merged_document.pdf' : 'merged_multiple_documents.pdf';
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    this.showStatus('PDFs merged successfully!', 'success');
                } else {
                    const result = await response.json();
                    throw new Error(result.error || 'Merge failed');
                }
            } catch (error) {
                this.showStatus(`Merge error: ${error.message}`, 'error');
            } finally {
                this.hideProgress();
                this.state.isProcessing = false;
            }
        },
        
        // Show progress modal
        showProgress(text) {
            if (!this.elements.progressModal) return;
            this.elements.progressText.textContent = text;
            this.elements.progressFill.style.width = '0%';
            this.elements.progressModal.style.display = 'flex';
            
            // Simulate progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 20;
                if (progress >= 90) {
                    clearInterval(interval);
                    progress = 90;
                }
                this.elements.progressFill.style.width = `${progress}%`;
            }, 200);
        },
        
        // Hide progress modal
        hideProgress() {
            if (!this.elements.progressModal) return;
            this.elements.progressFill.style.width = '100%';
            setTimeout(() => {
                this.elements.progressModal.style.display = 'none';
            }, 300);
        },
        
        // Show status message
        showStatus(message, type = 'info') {
            if (!this.elements.statusMessages) return;
            
            const statusDiv = document.createElement('div');
            statusDiv.className = `status-message ${type}`;
            statusDiv.textContent = message;
            
            this.elements.statusMessages.appendChild(statusDiv);
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                if (statusDiv.parentNode) {
                    statusDiv.parentNode.removeChild(statusDiv);
                }
            }, 5000);
            
            // Click to remove
            statusDiv.addEventListener('click', () => {
                if (statusDiv.parentNode) {
                    statusDiv.parentNode.removeChild(statusDiv);
                }
            });
        },
        
        // Format file size
        formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        },
        
        // Collect merge options (simplified)
        collectMergeOptions() {
            return {};
        },
        
        // Toggle functions (placeholder)
        toggleCustomOrder() {
            this.showStatus('Custom order feature ready for implementation', 'info');
        },
        
        togglePageRanges() {
            this.showStatus('Page ranges feature ready for implementation', 'info');
        },
        
        previewMerge() {
            this.showStatus('Preview functionality ready for implementation', 'info');
        },
        
        addBulkGroup() {
            this.showStatus('Bulk operations ready for implementation', 'info');
        },
        
        processBulkMerge() {
            this.showStatus('Bulk merge ready for implementation', 'info');
        }
    };
    
    // Initialize the application
    app.init();
});
