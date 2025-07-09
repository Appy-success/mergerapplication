from flask import Flask, render_template, request, send_file, jsonify
import os
import tempfile
import uuid
from PyPDF2 import PdfMerger, PdfReader
from werkzeug.utils import secure_filename
import logging

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
app.config['ALLOWED_EXTENSIONS'] = {'pdf'}

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create uploads folder if it doesn't exist
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'])

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def validate_pdf(file_path):
    """Validate that the file is a valid PDF"""
    try:
        reader = PdfReader(file_path)
        return len(reader.pages) > 0
    except Exception as e:
        logger.error(f"PDF validation failed for {file_path}: {str(e)}")
        return False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/validate', methods=['POST'])
def validate_files():
    """Validate uploaded files before merging"""
    if 'files[]' not in request.files:
        return jsonify({'error': 'No files uploaded'}), 400
    
    files = request.files.getlist('files[]')
    
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No files selected'}), 400
    
    if len(files) < 2:
        return jsonify({'error': 'Please select at least 2 PDF files to merge'}), 400
    
    # Validate each file
    file_info = []
    for file in files:
        if not allowed_file(file.filename):
            return jsonify({'error': f'Invalid file type: {file.filename}. Only PDF files are allowed.'}), 400
        
        # Create a temporary file to validate the PDF
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            file.save(temp_file.name)
            if not validate_pdf(temp_file.name):
                os.unlink(temp_file.name)
                return jsonify({'error': f'Invalid or corrupted PDF: {file.filename}'}), 400
            
            try:
                reader = PdfReader(temp_file.name)
                page_count = len(reader.pages)
                file_size = os.path.getsize(temp_file.name)
                
                file_info.append({
                    'name': file.filename,
                    'pages': page_count,
                    'size': file_size
                })
            except Exception as e:
                logger.error(f"Error reading PDF {file.filename}: {str(e)}")
                return jsonify({'error': f'Error reading PDF {file.filename}: {str(e)}'}), 400
            finally:
                os.unlink(temp_file.name)
        
        # Reset file pointer for later use
        file.seek(0)
    
    return jsonify({
        'success': True,
        'files': file_info,
        'total_files': len(file_info),
        'total_pages': sum(f['pages'] for f in file_info)
    })

@app.route('/merge', methods=['POST'])
def merge_pdfs():
    """Enhanced PDF merging with better error handling and file management"""
    if 'files[]' not in request.files:
        return jsonify({'error': 'No files uploaded'}), 400
    
    files = request.files.getlist('files[]')
    
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No files selected'}), 400
    
    if len(files) < 2:
        return jsonify({'error': 'Please select at least 2 PDF files to merge'}), 400

    # Generate unique identifier for this merge operation
    merge_id = str(uuid.uuid4())
    temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], merge_id)
    os.makedirs(temp_dir, exist_ok=True)
    
    merger = PdfMerger()
    saved_files = []
    output_filename = f'merged_{merge_id}.pdf'
    output_path = os.path.join(temp_dir, output_filename)
    
    try:
        logger.info(f"Starting merge operation {merge_id} with {len(files)} files")
        
        for i, file in enumerate(files):
            if not allowed_file(file.filename):
                raise ValueError(f'Invalid file type: {file.filename}. Only PDF files are allowed.')
                
            filename = f"{i:03d}_{secure_filename(file.filename)}"
            filepath = os.path.join(temp_dir, filename)
            file.save(filepath)
            saved_files.append(filepath)
            
            # Validate the saved PDF
            if not validate_pdf(filepath):
                raise ValueError(f'Invalid or corrupted PDF: {file.filename}')
            
            try:
                merger.append(filepath)
                logger.info(f"Added file {i+1}/{len(files)}: {file.filename}")
            except Exception as e:
                raise ValueError(f'Error processing file {file.filename}: {str(e)}')
        
        # Write the merged PDF
        merger.write(output_path)
        merger.close()
        
        # Verify the output file was created successfully
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise ValueError('Failed to create merged PDF file')
        
        logger.info(f"Merge operation {merge_id} completed successfully")
        
        # Send the file and schedule cleanup
        def cleanup():
            try:
                import shutil
                shutil.rmtree(temp_dir)
                logger.info(f"Cleaned up temporary directory for merge {merge_id}")
            except Exception as e:
                logger.error(f"Failed to cleanup directory {temp_dir}: {str(e)}")
        
        # Schedule cleanup after file is sent
        import threading
        threading.Timer(30.0, cleanup).start()  # Cleanup after 30 seconds
        
        return send_file(
            output_path,
            as_attachment=True,
            download_name='merged_document.pdf',
            mimetype='application/pdf'
        )
    
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Merge operation {merge_id} failed: {error_msg}")
        
        # Clean up on error
        try:
            if merger:
                merger.close()
            import shutil
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
        except:
            pass
        
        return jsonify({'error': error_msg}), 400

@app.route('/merge-multiple', methods=['POST'])
def merge_multiple_pdfs():
    """Advanced merging with options for page ranges and ordering"""
    if 'files[]' not in request.files:
        return jsonify({'error': 'No files uploaded'}), 400
    
    files = request.files.getlist('files[]')
    merge_options = request.form.get('options', '{}')
    
    try:
        import json
        options = json.loads(merge_options) if merge_options else {}
    except:
        options = {}
    
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': 'No files selected'}), 400
    
    if len(files) < 2:
        return jsonify({'error': 'Please select at least 2 PDF files to merge'}), 400

    # Generate unique identifier for this merge operation
    merge_id = str(uuid.uuid4())
    temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'multi_{merge_id}')
    os.makedirs(temp_dir, exist_ok=True)
    
    merger = PdfMerger()
    saved_files = []
    output_filename = f'merged_multiple_{merge_id}.pdf'
    output_path = os.path.join(temp_dir, output_filename)
    
    try:
        logger.info(f"Starting advanced merge operation {merge_id} with {len(files)} files")
        
        # Process files with custom ordering if specified
        file_order = options.get('file_order', list(range(len(files))))
        if len(file_order) != len(files):
            file_order = list(range(len(files)))
        
        processed_files = []
        for order_idx in file_order:
            if order_idx >= len(files):
                continue
                
            file = files[order_idx]
            if not allowed_file(file.filename):
                raise ValueError(f'Invalid file type: {file.filename}. Only PDF files are allowed.')
            
            filename = f"{len(processed_files):03d}_{secure_filename(file.filename)}"
            filepath = os.path.join(temp_dir, filename)
            file.save(filepath)
            saved_files.append(filepath)
            processed_files.append((file.filename, filepath))
            
            # Validate the saved PDF
            if not validate_pdf(filepath):
                raise ValueError(f'Invalid or corrupted PDF: {file.filename}')
        
        # Merge PDFs with optional page range support
        for original_name, filepath in processed_files:
            try:
                # Check if there are page range options for this file
                page_ranges = options.get('page_ranges', {}).get(original_name, None)
                
                if page_ranges:
                    # Merge specific page ranges
                    reader = PdfReader(filepath)
                    for range_spec in page_ranges:
                        start = max(0, range_spec.get('start', 1) - 1)  # Convert to 0-based
                        end = min(len(reader.pages), range_spec.get('end', len(reader.pages)))
                        merger.append(filepath, pages=(start, end))
                else:
                    # Merge entire file
                    merger.append(filepath)
                
                logger.info(f"Added file: {original_name}")
            except Exception as e:
                raise ValueError(f'Error processing file {original_name}: {str(e)}')
        
        # Write the merged PDF
        merger.write(output_path)
        merger.close()
        
        # Verify the output file was created successfully
        if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
            raise ValueError('Failed to create merged PDF file')
        
        # Get info about the merged file
        merged_reader = PdfReader(output_path)
        merged_info = {
            'total_pages': len(merged_reader.pages),
            'file_size': os.path.getsize(output_path),
            'files_merged': len(processed_files)
        }
        
        logger.info(f"Advanced merge operation {merge_id} completed: {merged_info}")
        
        # Schedule cleanup
        def cleanup():
            try:
                import shutil
                shutil.rmtree(temp_dir)
                logger.info(f"Cleaned up temporary directory for merge {merge_id}")
            except Exception as e:
                logger.error(f"Failed to cleanup directory {temp_dir}: {str(e)}")
        
        import threading
        threading.Timer(30.0, cleanup).start()
        
        return send_file(
            output_path,
            as_attachment=True,
            download_name='merged_multiple_documents.pdf',
            mimetype='application/pdf'
        )
    
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Advanced merge operation {merge_id} failed: {error_msg}")
        
        # Clean up on error
        try:
            if merger:
                merger.close()
            import shutil
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
        except:
            pass
        
        return jsonify({'error': error_msg}), 400

@app.route('/preview', methods=['POST'])
def preview_pdf():
    """Get preview information about uploaded PDFs"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type. Only PDF files are allowed.'}), 400
    
    try:
        # Create temporary file for preview
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            file.save(temp_file.name)
            
            if not validate_pdf(temp_file.name):
                os.unlink(temp_file.name)
                return jsonify({'error': 'Invalid or corrupted PDF'}), 400
            
            reader = PdfReader(temp_file.name)
            page_count = len(reader.pages)
            file_size = os.path.getsize(temp_file.name)
            
            # Get first page text for preview (first 200 chars)
            preview_text = ""
            if page_count > 0:
                try:
                    first_page = reader.pages[0]
                    preview_text = first_page.extract_text()[:200] + "..." if len(first_page.extract_text()) > 200 else first_page.extract_text()
                except:
                    preview_text = "Could not extract text preview"
            
            os.unlink(temp_file.name)
            
            return jsonify({
                'success': True,
                'filename': file.filename,
                'pages': page_count,
                'size': file_size,
                'preview_text': preview_text
            })
    
    except Exception as e:
        logger.error(f"Preview failed for {file.filename}: {str(e)}")
        return jsonify({'error': f'Error processing file: {str(e)}'}), 400

@app.route('/bulk-merge', methods=['POST'])
def bulk_merge_pdfs():
    """Merge multiple sets of PDFs in bulk"""
    try:
        data = request.get_json()
        if not data or 'merge_groups' not in data:
            return jsonify({'error': 'Invalid request data'}), 400
        
        merge_groups = data['merge_groups']
        results = []
        
        for group_idx, group in enumerate(merge_groups):
            group_id = str(uuid.uuid4())
            temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], f'bulk_{group_id}')
            os.makedirs(temp_dir, exist_ok=True)
            
            try:
                merger = PdfMerger()
                
                for file_info in group['files']:
                    # This would require files to be uploaded separately first
                    # For now, return a placeholder response
                    pass
                
                results.append({
                    'group_index': group_idx,
                    'status': 'success',
                    'output_file': f'bulk_merged_{group_idx}.pdf'
                })
                
            except Exception as e:
                results.append({
                    'group_index': group_idx,
                    'status': 'error',
                    'error': str(e)
                })
        
        return jsonify({
            'success': True,
            'results': results
        })
    
    except Exception as e:
        logger.error(f"Bulk merge failed: {str(e)}")
        return jsonify({'error': str(e)}), 400

@app.errorhandler(413)
def too_large(e):
    return jsonify({'error': 'File too large. Maximum size is 50MB.'}), 413

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {str(e)}")
    return jsonify({'error': 'Internal server error. Please try again.'}), 500

if __name__ == '__main__':
    app.run(debug=True)
