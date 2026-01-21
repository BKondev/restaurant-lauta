

// Dynamic Base Path Detection
const BASE_PATH = window.location.pathname.includes('/resturant-website') ? '/resturant-website' : '';
const API_URL = `${BASE_PATH}/api`;

// Admin Panel JavaScript
let products = [];
let promoCodes = [];
let editingId = null;
let deleteId = null;
let editingPromoId = null;
// Selection state for Manage Products
let manageSelected = new Set();

// Update selection UI
function updateManageSelectionUI() {
    const count = manageSelected.size;
    
    // Bottom bar elements
    const countEl = document.getElementById('manage-selection-count');
    const bulkPromoBtn = document.getElementById('manage-bulk-promo-btn');
    const bulkDeleteBtn = document.getElementById('manage-bulk-delete-btn');
    const createBundleBtn = document.getElementById('manage-create-bundle-btn');
    
    // Top bar elements
    const countElTop = document.getElementById('manage-selection-count-top');
    const bulkPromoBtnTop = document.getElementById('manage-bulk-promo-btn-top');
    const bulkDeleteBtnTop = document.getElementById('manage-bulk-delete-btn-top');
    const createBundleBtnTop = document.getElementById('manage-create-bundle-btn-top');
    
    const selectAll = document.getElementById('manage-select-all');
    
    // Update bottom bar count
    if (countEl) {
        countEl.textContent = `${count} selected`;
    }
    
    // Update top bar count
    if (countElTop) {
        countElTop.textContent = `${count} selected`;
    }
    
    // Update bottom bar buttons
    if (bulkPromoBtn) {
        bulkPromoBtn.disabled = count === 0;
    }
    
    if (bulkDeleteBtn) {
        bulkDeleteBtn.disabled = count === 0;
    }
    
    if (createBundleBtn) {
        createBundleBtn.disabled = count < 2;
    }
    
    // Update top bar buttons
    if (bulkPromoBtnTop) {
        bulkPromoBtnTop.disabled = count === 0;
    }
    
    if (bulkDeleteBtnTop) {
        bulkDeleteBtnTop.disabled = count === 0;
    }
    
    if (createBundleBtnTop) {
        createBundleBtnTop.disabled = count < 2;
    }
    
    // Update select-all checkbox state
    if (selectAll) {
        const filtered = getFilteredProducts();
        if (filtered.length > 0) {
            const allSelected = filtered.every(p => manageSelected.has(p.id));
            selectAll.checked = allSelected;
            selectAll.indeterminate = !allSelected && count > 0;
        } else {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        }
    }
}

// Check authentication on page load
function checkAuth() {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
        // Not logged in, redirect to login page
        window.location.href = 'login';
        return false;
    }
    return true;
}

// Logout function
function logout() {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    window.location.href = 'login';
}

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!checkAuth()) {
        return;
    }
    
    loadProducts();
    loadRestaurantName();
    loadCustomization();
    setupForm();
    setupColorInputs();
    loadPromoCodes();
    initManageControls();
    loadCategories();
    initProductSearchUI();
    loadProductsForSearch();
    loadDeliverySettings();
    loadProductsForCombo();
    loadCities(); // Load cities for delivery management
});

// --- Product Search & Bulk Promo ---
let allProducts = [];
let manageCurrentPage = 1;
let manageItemsPerPage = 20;
let manageFilteredProducts = [];
let filteredProducts = [];
let selectedProductIds = new Set();

// Initialize Manage Products controls (search, select-all, bulk promo)
function initManageControls() {
    const selectAll = document.getElementById('manage-select-all');
    const bulkPromoBtn = document.getElementById('manage-bulk-promo-btn');
    const bulkDeleteBtn = document.getElementById('manage-bulk-delete-btn');
    const categoryPromoBtn = document.getElementById('manage-category-promo-btn');
    const createBundleBtn = document.getElementById('manage-create-bundle-btn');
    
    // Top buttons (duplicate controls)
    const bulkPromoBtnTop = document.getElementById('manage-bulk-promo-btn-top');
    const bulkDeleteBtnTop = document.getElementById('manage-bulk-delete-btn-top');
    const createBundleBtnTop = document.getElementById('manage-create-bundle-btn-top');

    // Initial UI update
    updateManageSelectionUI();

    if (selectAll) {
        selectAll.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Select all currently filtered rows
                const ids = getFilteredProducts().map(p => p.id);
                ids.forEach(id => manageSelected.add(id));
            } else {
                manageSelected.clear();
            }
            updateManageSelectionUI();
            renderProducts();
        });
    }

    if (createBundleBtn) {
        createBundleBtn.addEventListener('click', () => {
            if (manageSelected.size < 2) {
                alert('Please select at least 2 products to create a bundle.');
                return;
            }
            openBundleModal();
        });
    }
    
    if (createBundleBtnTop) {
        createBundleBtnTop.addEventListener('click', () => {
            if (manageSelected.size < 2) {
                alert('Please select at least 2 products to create a bundle.');
                return;
            }
            openBundleModal();
        });
    }

    if (bulkPromoBtn) {
        bulkPromoBtn.addEventListener('click', async () => {
            const ids = Array.from(manageSelected);
            if (ids.length === 0) { alert('Select at least one product.'); return; }
            const promo = await promptPromoConfig();
            if (!promo) return;
            await applyBatchPromo(ids, promo);
            // reload products and re-render
            await loadProducts();
            manageSelected.clear();
            if (selectAll) selectAll.checked = false;
        });
    }
    
    if (bulkPromoBtnTop) {
        bulkPromoBtnTop.addEventListener('click', async () => {
            const ids = Array.from(manageSelected);
            if (ids.length === 0) { alert('Select at least one product.'); return; }
            const promo = await promptPromoConfig();
            if (!promo) return;
            await applyBatchPromo(ids, promo);
            await loadProducts();
            manageSelected.clear();
            if (selectAll) selectAll.checked = false;
        });
    }

    // Bulk delete selected products (bottom button)
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', async () => {
            const ids = Array.from(manageSelected);
            if (ids.length === 0) { alert('Select at least one product.'); return; }
            if (!confirm(`Delete ${ids.length} selected product(s)? This cannot be undone.`)) return;
            try {
                const token = sessionStorage.getItem('adminToken');
                const res = await fetch(`${API_URL}/products/batch`, {
                    method: 'DELETE',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ ids })
                });
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                    console.error('Delete error:', res.status, errorData);
                    throw new Error(errorData.error || `Server error: ${res.status}`);
                }
                const result = await res.json();
                alert(`${result.count} product(s) deleted successfully`);
                await loadProducts();
                manageSelected.clear();
                if (selectAll) selectAll.checked = false;
                updateManageSelectionUI();
            } catch (e) {
                console.error('Delete failed:', e);
                alert(`Failed to delete products: ${e.message}`);
            }
        });
    }
    
    // Bulk delete selected products (top button)
    if (bulkDeleteBtnTop) {
        bulkDeleteBtnTop.addEventListener('click', async () => {
            const ids = Array.from(manageSelected);
            if (ids.length === 0) { alert('Select at least one product.'); return; }
            if (!confirm(`Delete ${ids.length} selected product(s)? This cannot be undone.`)) return;
            try {
                const token = sessionStorage.getItem('adminToken');
                const res = await fetch(`${API_URL}/products/batch`, {
                    method: 'DELETE',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` 
                    },
                    body: JSON.stringify({ ids })
                });
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                    console.error('Delete error:', res.status, errorData);
                    throw new Error(errorData.error || `Server error: ${res.status}`);
                }
                const result = await res.json();
                alert(`${result.count} product(s) deleted successfully`);
                await loadProducts();
                manageSelected.clear();
                if (selectAll) selectAll.checked = false;
                updateManageSelectionUI();
            } catch (e) {
                console.error('Delete failed:', e);
                alert(`Failed to delete products: ${e.message}`);
            }
        });
    }

    if (categoryPromoBtn) {
        categoryPromoBtn.addEventListener('click', async () => {
            const category = categorySelect.value;
            if (!category) { alert('Select a category.'); return; }
            const promo = await promptPromoConfig();
            if (!promo) return;
            await applyCategoryPromo(category, promo);
            await loadProducts();
            manageSelected.clear();
            if (selectAll) selectAll.checked = false;
        });
    }
}

function initProductSearchUI() {
    const searchInput = document.getElementById('product-search-input');
    const clearBtn = document.getElementById('product-search-clear');
    const selectAll = document.getElementById('select-all-products');
    const bulkPromoBtn = document.getElementById('bulk-promo-btn');
    const bulkCategorySelect = document.getElementById('bulk-category-select');
    const bulkCategoryPromoBtn = document.getElementById('bulk-category-promo-btn');

    if (!searchInput) return; // section may not exist

    // Populate category dropdown
    const categories = new Set();
    allProducts.forEach(p => categories.add(p.category));
    bulkCategorySelect.innerHTML = '<option value="">Select category...</option>' + Array.from(categories).map(c => `<option value="${c}">${c}</option>`).join('');

    // Debounced search
    let t;
    searchInput.addEventListener('input', () => {
        clearTimeout(t);
        t = setTimeout(applyProductSearch, 250);
    });

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        applyProductSearch();
    });

    selectAll.addEventListener('change', (e) => {
        if (e.target.checked) {
            filteredProducts.forEach(p => selectedProductIds.add(p.id));
        } else {
            selectedProductIds.clear();
        }
        renderSearchResults();
    });

    bulkPromoBtn.addEventListener('click', async () => {
        const ids = Array.from(selectedProductIds);
        if (ids.length === 0) { alert('Select at least one product.'); return; }
        const promo = await promptPromoConfig();
        if (!promo) return;
        await applyBatchPromo(ids, promo);
    });

    bulkCategoryPromoBtn.addEventListener('click', async () => {
        const category = bulkCategorySelect.value;
        if (!category) { alert('Select a category.'); return; }
        const promo = await promptPromoConfig();
        if (!promo) return;
        await applyCategoryPromo(category, promo);
    });
}

async function loadProductsForSearch() {
    try {
        const res = await fetch(`${API_URL}/products`);
        allProducts = await res.json();
        filteredProducts = allProducts;
        applyProductSearch();
    } catch (e) {
        console.error('Failed to load products', e);
    }
}

function applyProductSearch() {
    const q = (document.getElementById('product-search-input')?.value || '').trim().toLowerCase();
    if (!q) {
        filteredProducts = allProducts;
    } else {
        filteredProducts = allProducts.filter(p => {
            const en = (p.name || '').toLowerCase();
            const bg = (p.translations?.bg?.name || '').toLowerCase();
            const idStr = String(p.id || '');
            return en.includes(q) || bg.includes(q) || idStr === q;
        });
    }
    renderSearchResults();
}

function renderSearchResults() {
    // Reuse existing products table if present; else create a lightweight list below search
    let container = document.getElementById('search-results');
    if (!container) {
        container = document.createElement('div');
        container.id = 'search-results';
        const section = document.getElementById('product-search-section');
        if (section) {
            section.appendChild(container);
        } else {
            console.error('Product search section not found');
            return;
        }
    }
    
    if (!filteredProducts || filteredProducts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No products found</p>';
        return;
    }
    
    container.innerHTML = `
        <table class="admin-table">
            <thead>
                <tr>
                    <th>Select</th>
                    <th>ID</th>
                    <th>EN Name</th>
                    <th>BG Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Promo</th>
                </tr>
            </thead>
            <tbody>
                ${filteredProducts.map(p => `
                    <tr>
                        <td><input type="checkbox" ${selectedProductIds.has(p.id) ? 'checked' : ''} onchange="toggleSelectProduct(${p.id}, this.checked)"></td>
                        <td>${p.id}</td>
                        <td>${escapeHtml(p.name || '')}</td>
                        <td>${escapeHtml(p.translations?.bg?.name || '')}</td>
                        <td>${escapeHtml(p.category || '')}</td>
                        <td>${Number(p.price).toFixed(2)} лв</td>
                        <td>${p.promo?.enabled ? `<span class="badge" style="background:#e74c3c;color:#fff;">${Number(p.promo.price).toFixed(2)} лв</span>` : '-'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function toggleSelectProduct(id, checked) {
    if (checked) selectedProductIds.add(id); else selectedProductIds.delete(id);
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

async function promptPromoConfig() {
    // Prompt for percentage discount
    const percentage = prompt('Discount percentage (e.g., 25 for 25% off):');
    if (percentage == null) return null;
    const discount = Number(percentage);
    if (Number.isNaN(discount) || discount <= 0 || discount >= 100) { 
        alert('Invalid percentage. Must be between 1 and 99.'); 
        return null; 
    }
    return { discount, type: 'permanent' };
}

async function applyBatchPromo(ids, promoConfig) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const res = await fetch(`${API_URL}/products/promo/batch`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ ids, discount: promoConfig.discount })
        });
        if (!res.ok) throw new Error('Batch promo failed');
        await loadProductsForSearch();
        alert('Promo applied to selected products');
    } catch (e) { console.error(e); alert('Failed to apply promo'); }
}

async function applyCategoryPromo(category, promoConfig) {
    try {
        const token = sessionStorage.getItem('adminToken');
        const res = await fetch(`${API_URL}/products/promo/category/${encodeURIComponent(category)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ discount: promoConfig.discount })
        });
        if (!res.ok) throw new Error('Category promo failed');
        await loadProductsForSearch();
        alert(`Promo applied to category ${category}`);
    } catch (e) { console.error(e); alert('Failed to apply category promo'); }
}

// Load products from server
async function loadProducts() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/products`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        products = await response.json();
        renderProducts();
        updateCategoryFilter();
        updatePromoCodeCategoryDropdown();
        updateManageCategoryDropdown();
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products. Make sure the server is running.');
    }
}

// Show error message
function showError(message) {
    const tbody = document.getElementById('products-table-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="5" style="text-align: center; padding: 40px; color: #e74c3c;">
                <i class="fas fa-exclamation-circle" style="font-size: 40px; margin-bottom: 15px;"></i>
                <div>${message}</div>
                <div style="margin-top: 10px; color: #666; font-size: 14px;">Run: npm install && npm start</div>
            </td>
        </tr>
    `;
}

// Load restaurant settings (name and logo)
async function loadRestaurantName() {
    try {
        const response = await fetch(`${API_URL}/settings`);
        const data = await response.json();
        document.getElementById('restaurant-name-input').value = data.name;
        document.getElementById('restaurant-logo-input').value = data.logo || '';
    } catch (error) {
        console.error('Error loading restaurant settings:', error);
    }
}

// Update restaurant settings (name and logo)
async function updateRestaurantSettings() {
    const name = document.getElementById('restaurant-name-input').value.trim();
    const logo = document.getElementById('restaurant-logo-input').value.trim();
    
    if (!name) {
        alert('Please enter a restaurant name');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/settings`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, logo })
        });
        
        if (response.status === 401) {
        alert('Session expired. Please login again.');
        window.location.href = `${BASE_PATH}/login`;
            return;
        }
        
        if (response.ok) {
            alert('Restaurant settings updated successfully!');
        } else {
            alert('Failed to update restaurant settings');
        }
    } catch (error) {
        console.error('Error updating restaurant settings:', error);
        alert('Error updating restaurant settings');
    }
}

// Backward compatibility
async function updateRestaurantName() {
    await updateRestaurantSettings();
}

// Setup form submission
function setupForm() {
    const form = document.getElementById('product-form');
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        saveProduct();
    });
}

// Handle image upload
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        alert('File is too large. Maximum size is 5MB.');
        event.target.value = '';
        return;
    }
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        showImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
    
    // Upload to server
    try {
        const token = sessionStorage.getItem('adminToken');
        const formData = new FormData();
        formData.append('image', file);
        
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('product-image').value = data.imageUrl;
            alert('Image uploaded successfully!');
        } else {
            alert('Failed to upload image');
        }
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Error uploading image');
    }
}

// Show image preview
function showImagePreview(url) {
    const preview = document.getElementById('image-preview');
    
    let displayUrl = url;
    if (url && url.startsWith('/uploads/')) {
        displayUrl = `${BASE_PATH}${url}`;
    }
    
    preview.innerHTML = `<img src="${displayUrl}" alt="Preview">`;
    preview.classList.add('active');
}

// Save product (add or edit)
async function saveProduct() {
    const name = document.getElementById('product-name').value.trim();
    const description = document.getElementById('product-description').value.trim();
    const price = parseFloat(document.getElementById('product-price').value);
    const category = document.getElementById('product-category').value.trim();
    const image = document.getElementById('product-image').value.trim();
    const weight = document.getElementById('product-weight').value.trim();
    
    // Bulgarian translations (optional)
    const nameBg = document.getElementById('product-name-bg').value.trim();
    const descriptionBg = document.getElementById('product-description-bg').value.trim();
    const categoryBg = document.getElementById('product-category-bg').value.trim();
    
    if (!name || !description || !price || !category) {
        alert('Please fill in all required English fields');
        return;
    }
    
    const productData = {
        name,
        description,
        price,
        category,
        image: image || 'https://via.placeholder.com/280x200?text=No+Image',
        weight: weight || '',
        translations: {
            bg: {
                name: nameBg || name,
                description: descriptionBg || description,
                category: categoryBg || category
            }
        }
    };
    
    // Add promo data if enabled
    const promoEnabled = document.getElementById('promo-enabled').checked;
    if (promoEnabled) {
        const promoPrice = parseFloat(document.getElementById('promo-price').value);
        if (!promoPrice || promoPrice >= price) {
            alert('Promo price must be less than regular price');
            return;
        }
        
        productData.promo = {
            enabled: true,
            price: promoPrice,
            type: document.getElementById('promo-type').value
        };
        
        if (productData.promo.type === 'timed') {
            const startDate = document.getElementById('promo-start').value;
            const endDate = document.getElementById('promo-end').value;
            
            if (!startDate || !endDate) {
                alert('Please set start and end dates for timed promotion');
                return;
            }
            
            if (new Date(endDate) <= new Date(startDate)) {
                alert('End date must be after start date');
                return;
            }
            
            productData.promo.startDate = startDate;
            productData.promo.endDate = endDate;
        }
    } else {
        productData.promo = null;
    }
    
    try {
        const token = sessionStorage.getItem('adminToken');
        let response;
        if (editingId) {
            // Update existing product
            response = await fetch(`${API_URL}/products/${editingId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productData)
            });
        } else {
            // Add new product
            response = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productData)
            });
        }
        
        if (response.ok) {
            alert(editingId ? 'Product updated successfully!' : 'Product added successfully!');
            resetForm();
            loadProducts();
        } else {
            alert('Failed to save product');
        }
    } catch (error) {
        console.error('Error saving product:', error);
        alert('Error saving product');
    }
}

// Edit product
function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    
    editingId = id;
    
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-description').value = product.description;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-category').value = product.category;
    document.getElementById('product-image').value = product.image;
    document.getElementById('product-weight').value = product.weight || '';
    
    // Populate Bulgarian translations if available
    if (product.translations && product.translations.bg) {
        document.getElementById('product-name-bg').value = product.translations.bg.name || '';
        document.getElementById('product-description-bg').value = product.translations.bg.description || '';
        document.getElementById('product-category-bg').value = product.translations.bg.category || '';
    } else {
        document.getElementById('product-name-bg').value = '';
        document.getElementById('product-description-bg').value = '';
        document.getElementById('product-category-bg').value = '';
    }
    
    // Handle promo data
    if (product.promo && product.promo.enabled) {
        document.getElementById('promo-enabled').checked = true;
        togglePromoFields();
        document.getElementById('promo-price').value = product.promo.price;
        document.getElementById('promo-type').value = product.promo.type || 'permanent';
        togglePromoDateFields();
        
        if (product.promo.startDate) {
            document.getElementById('promo-start').value = product.promo.startDate;
        }
        if (product.promo.endDate) {
            document.getElementById('promo-end').value = product.promo.endDate;
        }
    } else {
        document.getElementById('promo-enabled').checked = false;
        togglePromoFields();
    }
    
    if (product.image && product.image !== 'https://via.placeholder.com/280x200?text=No+Image') {
        showImagePreview(product.image);
    }
    
    document.getElementById('form-title').textContent = 'Edit Product';
    document.getElementById('submit-text').textContent = 'Update Product';
    document.getElementById('cancel-btn').style.display = 'inline-flex';
    
    // Scroll to form
    document.querySelector('.product-form').scrollIntoView({ behavior: 'smooth' });
}

// Delete product
function deleteProduct(id) {
    deleteId = id;
    document.getElementById('delete-modal').style.display = 'block';
}

// Confirm delete
async function confirmDelete() {
    if (!deleteId) return;
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/products/${deleteId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            alert('Product deleted successfully!');
            closeDeleteModal();
            loadProducts();
        } else {
            alert('Failed to delete product');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product');
    }
}

// Close delete modal
function closeDeleteModal() {
    document.getElementById('delete-modal').style.display = 'none';
    deleteId = null;
}

// Cancel edit
function cancelEdit() {
    resetForm();
}

// Reset form
function resetForm() {
    editingId = null;
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('image-preview').classList.remove('active');
    document.getElementById('image-preview').innerHTML = '';
    document.getElementById('form-title').textContent = 'Add New Product';
    document.getElementById('submit-text').textContent = 'Add Product';
    document.getElementById('cancel-btn').style.display = 'none';
    
    // Reset promo fields
    document.getElementById('promo-enabled').checked = false;
    togglePromoFields();
}

// Render products table
function renderProducts() {
    const tbody = document.getElementById('products-table-body');
    const noProducts = document.getElementById('no-products');
    const pageInfo = document.getElementById('manage-page-info');
    const searchTerm = document.getElementById('admin-search').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('category-filter').value;
    
    let filteredProducts = products;
    
    // Enhanced search: by EN name, BG name, description, category, or exact ID
    if (searchTerm) {
        filteredProducts = filteredProducts.filter(p => {
            const enName = (p.name || '').toLowerCase();
            const bgName = (p.translations?.bg?.name || '').toLowerCase();
            const enDesc = (p.description || '').toLowerCase();
            const bgDesc = (p.translations?.bg?.description || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            const idStr = String(p.id || '');
            
            return enName.includes(searchTerm) || 
                   bgName.includes(searchTerm) || 
                   enDesc.includes(searchTerm) ||
                   bgDesc.includes(searchTerm) ||
                   category.includes(searchTerm) ||
                   idStr === searchTerm;
        });
    }
    
    // Filter by category
    if (categoryFilter && categoryFilter !== 'all') {
        filteredProducts = filteredProducts.filter(p => p.category === categoryFilter);
    }
    
    manageFilteredProducts = filteredProducts;
    
    if (filteredProducts.length === 0) {
        tbody.innerHTML = '';
        noProducts.style.display = 'block';
        if (pageInfo) pageInfo.textContent = 'Page 0 of 0';
        return;
    }
    
    noProducts.style.display = 'none';
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredProducts.length / manageItemsPerPage);
    if (manageCurrentPage > totalPages) manageCurrentPage = totalPages;
    if (manageCurrentPage < 1) manageCurrentPage = 1;
    
    const startIndex = (manageCurrentPage - 1) * manageItemsPerPage;
    const endIndex = startIndex + manageItemsPerPage;
    const pageProducts = filteredProducts.slice(startIndex, endIndex);
    
    tbody.innerHTML = pageProducts.map(product => {
            const imageUrl = product.image || '';
            const enName = product.name || '';
            const bgName = product.translations?.bg?.name || '';
            const category = product.category || '';
            const hasPromo = !!(product.promo && product.promo.enabled && typeof product.promo.price === 'number');
            const promoDisplay = hasPromo ? `${product.promo.price.toFixed(2)} лв` : '-';
            const priceDisplay = `${(product.price ?? 0).toFixed(2)} лв`;

            return `
                <tr>
                    <td style="width:40px;" data-label="Select">
                        <input type="checkbox" ${manageSelected.has(product.id) ? 'checked' : ''} onclick="toggleManageSelect(${product.id}, this.checked)">
                    </td>
                    <td data-label="ID">${product.id}</td>
                    <td data-label="EN Name">${enName}</td>
                    <td data-label="BG Name">${bgName}</td>
                    <td data-label="Category"><span class="product-category">${category}</span></td>
                    <td data-label="Price"><span class="product-price">${priceDisplay}</span></td>
                    <td data-label="Promo">${hasPromo ? `<span class="product-price" style="background:#e74c3c; color:#fff; padding:4px 8px; border-radius:6px; font-weight:700;">${promoDisplay}</span>` : '-'}</td>
                    <td data-label="Image">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${enName}" class="product-img-thumb" onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'">` : `<img src="https://via.placeholder.com/80x80?text=No+Image" alt="${enName}" class="product-img-thumb">`}
                    </td>
                    <td data-label="Actions">
                        <div class="product-actions">
                            <button onclick="editProduct(${product.id})" class="btn btn-primary btn-small">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button onclick="deleteProduct(${product.id})" class="btn btn-danger btn-small">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    }).join('');
    
    // Update page info
    if (pageInfo) {
        pageInfo.textContent = `Page ${manageCurrentPage} of ${totalPages} (${filteredProducts.length} products)`;
    }
}

// Manage Products Pagination
function previousManagePage() {
    if (manageCurrentPage > 1) {
        manageCurrentPage--;
        renderProducts();
    }
}

function nextManagePage() {
    const totalPages = Math.ceil(manageFilteredProducts.length / manageItemsPerPage);
    if (manageCurrentPage < totalPages) {
        manageCurrentPage++;
        renderProducts();
    }
}

// Helper: get current filtered products (used by select-all)
function getFilteredProducts() {
    const searchTerm = document.getElementById('admin-search').value.toLowerCase().trim();
    const categoryFilter = document.getElementById('category-filter').value;

    let result = products.slice();
    
    // Enhanced search: by EN name, BG name, description, category, or exact ID
    if (searchTerm) {
        result = result.filter(p => {
            const enName = (p.name || '').toLowerCase();
            const bgName = (p.translations?.bg?.name || '').toLowerCase();
            const enDesc = (p.description || '').toLowerCase();
            const bgDesc = (p.translations?.bg?.description || '').toLowerCase();
            const category = (p.category || '').toLowerCase();
            const idStr = String(p.id || '');
            
            return enName.includes(searchTerm) || 
                   bgName.includes(searchTerm) || 
                   enDesc.includes(searchTerm) ||
                   bgDesc.includes(searchTerm) ||
                   category.includes(searchTerm) ||
                   idStr === searchTerm;
        });
    }
    
    if (categoryFilter && categoryFilter !== 'all') {
        result = result.filter(p => p.category === categoryFilter);
    }
    return result;
}

// Toggle selection for Manage Products
function toggleManageSelect(id, checked) {
    if (checked) manageSelected.add(id); else manageSelected.delete(id);
    updateManageSelectionUI();
}

// Filter products
function filterProducts() {
    renderProducts();
}

// Update category filter dropdown
function updateCategoryFilter() {
    const select = document.getElementById('category-filter');
    const categories = [...new Set(products.map(p => p.category))].sort();
    
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Categories</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
    
    if (currentValue && categories.includes(currentValue)) {
        select.value = currentValue;
    }
}

// Update manage category dropdown for bulk promo
function updateManageCategoryDropdown() {
    const select = document.getElementById('manage-category-select');
    if (!select) return;
    
    const categories = [...new Set(products.map(p => p.category))].sort();
    const currentValue = select.value;
    
    select.innerHTML = '<option value="">Select category...</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
    
    if (currentValue && categories.includes(currentValue)) {
        select.value = currentValue;
    }
}

// Export data
async function exportData() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/export`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'restaurant-data.json';
        link.click();
        
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data');
    }
}

// Import data
function importData() {
    document.getElementById('import-file').click();
}

// Handle import
async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.products && Array.isArray(data.products)) {
                if (confirm('This will replace all current data. Are you sure?')) {
                    const token = sessionStorage.getItem('adminToken');
                    const response = await fetch(`${API_URL}/import`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(data)
                    });
                    
                    if (response.ok) {
                        alert('Data imported successfully!');
                        loadProducts();
                        loadRestaurantName();
                    } else {
                        alert('Failed to import data');
                    }
                }
            } else {
                alert('Invalid data format');
            }
        } catch (error) {
            alert('Error importing data: ' + error.message);
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

// Reset data
async function resetData() {
    if (confirm('This will delete all products and reset the restaurant name. Are you sure?')) {
        if (confirm('Are you REALLY sure? This action cannot be undone!')) {
            try {
                const token = sessionStorage.getItem('adminToken');
                const response = await fetch(`${API_URL}/reset`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (response.ok) {
                    alert('All data has been reset');
                    loadProducts();
                    document.getElementById('restaurant-name-input').value = 'Restaurant Name';
                } else {
                    alert('Failed to reset data');
                }
            } catch (error) {
                console.error('Error resetting data:', error);
                alert('Error resetting data');
            }
        }
    }
}

// ========== CSV IMPORT/EXPORT FUNCTIONS ==========

// Download CSV Template
function downloadCSVTemplate() {
    const headers = [
        'name_en',
        'name_bg',
        'description_en',
        'description_bg',
        'category_en',
        'category_bg',
        'price',
        'image_url',
        'promo_enabled',
        'promo_price',
        'promo_type',
        'promo_start',
        'promo_end',
        'special_label'
    ];
    
    const exampleRow = [
        'Margherita Pizza',
        'Пица Маргарита',
        'Classic pizza with tomato sauce, mozzarella and basil',
        'Класическа пица с доматен сос, моцарела и босилек',
        'Pizza',
        'Пица',
        '12.99',
        'https://example.com/pizza.jpg',
        'yes',
        '9.99',
        'permanent',
        '',
        '',
        'SPECIAL'
    ];
    
    const csvContent = [
        headers.join(','),
        exampleRow.map(cell => `"${cell}"`).join(','),
        // Add empty rows for filling
        headers.map(() => '').join(','),
        headers.map(() => '').join(',')
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'products-template.csv';
    link.click();
    URL.revokeObjectURL(url);
    
    alert('CSV template downloaded! Fill it with your products and upload it back.');
}

// Export Products to CSV
async function exportProductsCSV() {
    try {
        const response = await fetch(`${API_URL}/products`);
        const products = await response.json();
        
        if (products.length === 0) {
            alert('No products to export!');
            return;
        }
        
        const headers = [
            'name_en',
            'name_bg',
            'description_en',
            'description_bg',
            'category_en',
            'category_bg',
            'price',
            'image_url',
            'promo_enabled',
            'promo_price',
            'promo_type',
            'promo_start',
            'promo_end',
            'special_label'
        ];
        
        const rows = products.map(p => [
            p.name || '',
            p.nameBg || p.translations?.bg?.name || '',
            p.description || '',
            p.descriptionBg || p.translations?.bg?.description || '',
            p.category || '',
            p.categoryBg || p.translations?.bg?.category || '',
            p.price || '',
            p.image || '',
            p.promo?.isActive ? 'yes' : 'no',
            p.promo?.price || '',
            p.promo?.type || '',
            p.promo?.startDate || '',
            p.promo?.endDate || '',
            p.specialLabel || ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        alert('Products exported to CSV successfully!');
    } catch (error) {
        console.error('Error exporting products to CSV:', error);
        alert('Error exporting products to CSV');
    }
}

// Handle CSV Import
async function handleCSVImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const csvText = e.target.result;
            const lines = csvText.split('\n').filter(line => line.trim());
            
            if (lines.length < 2) {
                alert('CSV file is empty or invalid!');
                return;
            }
            
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const products = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                
                if (values.length === 0 || !values[0]) continue; // Skip empty rows
                
                const product = {
                    name: values[0] || '',
                    nameBg: values[1] || values[0],
                    description: values[2] || '',
                    descriptionBg: values[3] || values[2],
                    category: values[4] || 'Other',
                    categoryBg: values[5] || values[4] || 'Друго',
                    price: parseFloat(values[6]) || 0,
                    image: values[7] || 'https://via.placeholder.com/300x200?text=No+Image',
                    translations: {
                        bg: {
                            name: values[1] || values[0],
                            description: values[3] || values[2],
                            category: values[5] || values[4] || 'Друго'
                        }
                    }
                };
                
                // Handle promo if enabled
                if (values[8] && values[8].toLowerCase() === 'yes') {
                    product.promo = {
                        isActive: true,
                        price: parseFloat(values[9]) || product.price * 0.8,
                        type: values[10] || 'permanent',
                        startDate: values[11] || null,
                        endDate: values[12] || null
                    };
                }
                
                // Handle special label
                if (values[13]) {
                    product.specialLabel = values[13];
                }
                
                products.push(product);
            }
            
            if (products.length === 0) {
                alert('No valid products found in CSV file!');
                return;
            }
            
            if (!confirm(`Found ${products.length} product(s) in CSV. Import them now?`)) {
                return;
            }
            
            // Import products
            const token = sessionStorage.getItem('adminToken');
            let successCount = 0;
            let errorCount = 0;
            
            for (const product of products) {
                try {
                    const response = await fetch(`${API_URL}/products`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(product)
                    });
                    
                    if (response.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    errorCount++;
                }
            }
            
            alert(`Import completed!\nSuccessful: ${successCount}\nFailed: ${errorCount}`);
            await loadProducts();
            
        } catch (error) {
            console.error('Error importing CSV:', error);
            alert('Error importing CSV: ' + error.message);
        }
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

// Parse CSV line (handles quoted fields with commas)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"' && inQuotes && nextChar === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
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
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('delete-modal');
    if (event.target === modal) {
        closeDeleteModal();
    }
};

// ========== CUSTOMIZATION FUNCTIONS ==========

// Setup color input synchronization
function setupColorInputs() {
    const colorPairs = [
        ['top-bar-color', 'top-bar-color-text'],
        ['highlight-color', 'highlight-color-text'],
        ['background-color', 'background-color-text'],
        ['price-color', 'price-color-text']
    ];
    
    colorPairs.forEach(([colorId, textId]) => {
        const colorInput = document.getElementById(colorId);
        const textInput = document.getElementById(textId);
        
        colorInput.addEventListener('input', () => {
            textInput.value = colorInput.value;
        });
        
        textInput.addEventListener('input', () => {
            if (/^#[0-9A-F]{6}$/i.test(textInput.value)) {
                colorInput.value = textInput.value;
            }
        });
    });
}

// Load customization settings
async function loadCustomization() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/settings/customization`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        
        if (data) {
            document.getElementById('top-bar-color').value = data.topBarColor || '#2c3e50';
            document.getElementById('top-bar-color-text').value = data.topBarColor || '#2c3e50';
            document.getElementById('highlight-color').value = data.highlightColor || '#e74c3c';
            document.getElementById('highlight-color-text').value = data.highlightColor || '#e74c3c';
            document.getElementById('background-color').value = data.backgroundColor || '#f5f5f5';
            document.getElementById('background-color-text').value = data.backgroundColor || '#f5f5f5';
            document.getElementById('price-color').value = data.priceColor || '#e74c3c';
            document.getElementById('price-color-text').value = data.priceColor || '#e74c3c';
            document.getElementById('background-image').value = data.backgroundImage || '';
        }
    } catch (error) {
        console.error('Error loading customization:', error);
    }
}

// Update customization settings
async function updateCustomization() {
    const customization = {
        topBarColor: document.getElementById('top-bar-color').value,
        backgroundColor: document.getElementById('background-color').value,
        backgroundImage: document.getElementById('background-image').value,
        highlightColor: document.getElementById('highlight-color').value,
        priceColor: document.getElementById('price-color').value
    };
    
    try {
        const token = sessionStorage.getItem('adminToken');
        if (!token) {
            alert('Session expired. Please login again.');
            window.location.href = `${BASE_PATH}/login`;
            return;
        }
        
        const response = await fetch(`${API_URL}/settings/customization`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(customization)
        });
        
        if (response.status === 401) {
            alert('Session expired. Please login again.');
            window.location.href = '/login';
            return;
        }
        
        if (response.ok) {
            alert('Customization updated successfully!');
        } else {
            alert('Failed to update customization');
        }
    } catch (error) {
        console.error('Error updating customization:', error);
        alert('Error updating customization');
    }
}

// Update currency settings
async function updateCurrencySettings() {
    const currencySettings = {
        eurToBgnRate: parseFloat(document.getElementById('eur-to-bgn-rate').value) || 1.9558,
        showBgnPrices: document.getElementById('show-bgn-prices').checked
    };
    
    try {
        const token = sessionStorage.getItem('adminToken');
        if (!token) {
            alert('Session expired. Please login again.');
            window.location.href = `${BASE_PATH}/login`;
            return;
        }
        
        const response = await fetch(`${API_URL}/settings/currency`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(currencySettings)
        });
        
        if (response.status === 401) {
            alert('Session expired. Please login again.');
            window.location.href = '/login';
            return;
        }
        
        if (response.ok) {
            alert('Currency settings updated successfully!');
        } else {
            alert('Failed to update currency settings');
        }
    } catch (error) {
        console.error('Error updating currency settings:', error);
        alert('Error updating currency settings');
    }
}

// Load currency settings
async function loadCurrencySettings() {
    try {
        const response = await fetch(`${API_URL}/settings/currency`);
        const settings = await response.json();
        
        document.getElementById('eur-to-bgn-rate').value = settings.eurToBgnRate || 1.9558;
        document.getElementById('show-bgn-prices').checked = settings.showBgnPrices !== false;
    } catch (error) {
        console.error('Error loading currency settings:', error);
    }
}

// ========== ORDER SETTINGS FUNCTIONS ==========

async function updateOrderSettings() {
    if (!currentUser) {
        alert('Please login first');
        return;
    }

    const orderSettings = {
        minimumOrderAmount: parseFloat(document.getElementById('minimum-order-amount').value) || 0
    };

    try {
        const response = await fetch(`${API_URL}/settings/order`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify(orderSettings)
        });

        if (response.ok) {
            alert('Order settings updated successfully!');
        } else {
            alert('Failed to update order settings');
        }
    } catch (error) {
        console.error('Error updating order settings:', error);
        alert('Error updating order settings');
    }
}

async function loadOrderSettings() {
    try {
        const response = await fetch(`${API_URL}/settings/order`);
        const settings = await response.json();
        
        document.getElementById('minimum-order-amount').value = settings.minimumOrderAmount || 0;
    } catch (error) {
        console.error('Error loading order settings:', error);
    }
}

// ========== WORKING HOURS FUNCTIONS ==========

// Update working hours
async function updateWorkingHours() {
    if (!currentUser) {
        alert('Please login first');
        return;
    }

    const workingHours = {
        openingTime: document.getElementById('opening-time').value,
        closingTime: document.getElementById('closing-time').value
    };

    try {
        const response = await fetch(`${API_URL}/settings/working-hours`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentUser.token}`
            },
            body: JSON.stringify(workingHours)
        });

        if (response.ok) {
            alert('Working hours updated successfully!');
        } else {
            alert('Failed to update working hours');
        }
    } catch (error) {
        console.error('Error updating working hours:', error);
        alert('Error updating working hours');
    }
}

// Load working hours
async function loadWorkingHours() {
    try {
        const response = await fetch(`${API_URL}/settings/working-hours`);
        const settings = await response.json();
        
        document.getElementById('opening-time').value = settings.openingTime || '09:00';
        document.getElementById('closing-time').value = settings.closingTime || '22:00';
    } catch (error) {
        console.error('Error loading working hours:', error);
    }
}

// ========== DELIVERY ZONES FUNCTIONS ==========

let zonesMap = null;
let drawnItems = null;
let deliveryZones = [];

// Initialize zones map
function initializeZonesMap() {
    if (!document.getElementById('zones-map')) return;
    
    // Center on Plovdiv, Bulgaria
    zonesMap = L.map('zones-map').setView([42.1354, 24.7453], 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(zonesMap);
    
    // Initialize drawn items layer
    drawnItems = new L.FeatureGroup();
    zonesMap.addLayer(drawnItems);
    
    // Add drawing controls
    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems
        },
        draw: {
            polygon: true,
            polyline: false,
            rectangle: false,
            circle: false,
            marker: false,
            circlemarker: false
        }
    });
    zonesMap.addControl(drawControl);
    
    // Handle drawn shapes
    zonesMap.on(L.Draw.Event.CREATED, function(e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);
    });
    
    loadDeliveryZones();
}

// Load existing zones
async function loadDeliveryZones() {
    try {
        const response = await fetch(`${API_URL}/delivery-zones`);
        deliveryZones = await response.json();
        
        // Clear existing layers first
        drawnItems.clearLayers();
        
        // Draw zones on map
        if (deliveryZones && Array.isArray(deliveryZones)) {
            deliveryZones.forEach(zone => {
                if (zone.coordinates && zone.coordinates.length > 0) {
                    const polygon = L.polygon(zone.coordinates).addTo(drawnItems);
                    polygon.bindPopup(`<b>${zone.name}</b><br>EUR${zone.price}`);
                }
            });
        }
        
        renderZonesList();
    } catch (error) {
        console.error('Error loading delivery zones:', error);
    }
}

// Save zones
async function saveZones() {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
        alert('Please login first');
        return;
    }
    
    const zoneName = document.getElementById('zone-name');
    const zonePrice = document.getElementById('zone-price');
    
    if (!zoneName || !zonePrice) {
        alert('Please enter zone name and price');
        return;
    }
    
    if (!zoneName.value.trim() || !zonePrice.value) {
        alert('Please enter zone name and price before saving');
        return;
    }
    
    // Get all existing zones
    const zones = [...deliveryZones];
    
    // Add new zones from drawn items
    let newZonesCount = 0;
    drawnItems.eachLayer(function(layer) {
        if (layer instanceof L.Polygon) {
            const coords = layer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]);
            
            // Check if this zone already exists (by comparing coordinates)
            const exists = zones.some(z => JSON.stringify(z.coordinates) === JSON.stringify(coords));
            
            if (!exists) {
                zones.push({
                    name: zoneName.value,
                    price: parseFloat(zonePrice.value),
                    coordinates: coords
                });
                newZonesCount++;
            }
        }
    });
    
    if (newZonesCount === 0 && zones.length === deliveryZones.length) {
        alert('No new zones to save. Please draw a zone first.');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/delivery-zones`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ zones })
        });
        
        if (response.ok) {
            alert(`Successfully saved ${newZonesCount} new zone(s)!`);
            zoneName.value = '';
            zonePrice.value = '';
            await loadDeliveryZones();
        } else {
            const error = await response.text();
            alert('Failed to save delivery zones: ' + error);
        }
    } catch (error) {
        console.error('Error saving zones:', error);
        alert('Error saving zones: ' + error.message);
    }
}

// Clear all zones
function clearAllZones() {
    if (confirm('Are you sure you want to clear all zones?')) {
        drawnItems.clearLayers();
        deliveryZones = [];
        renderZonesList();
    }
}

// Start drawing a new zone
function startDrawingZone() {
    const zoneName = document.getElementById('zone-name');
    const zonePrice = document.getElementById('zone-price');
    
    if (!zoneName.value || !zonePrice.value) {
        alert('Please enter zone name and price before drawing');
        return;
    }
    
    // Enable polygon drawing tool
    const polygonDrawer = new L.Draw.Polygon(zonesMap);
    polygonDrawer.enable();
}

// Render zones list
function renderZonesList() {
    const list = document.getElementById('zones-list');
    if (!list) return;
    
    if (!deliveryZones || deliveryZones.length === 0) {
        list.innerHTML = '<p style="color: #999;">No zones yet. Draw zones and save them.</p>';
        return;
    }
    
    list.innerHTML = '<h3>Current Zones:</h3>';
    deliveryZones.forEach((zone, index) => {
        list.innerHTML += `
            <div style="padding: 10px; background: #f5f5f5; margin: 5px 0; border-radius: 5px;">
                <strong>${zone.name}</strong> - EUR${zone.price}
            </div>
        `;
    });
}

// ========== PROMO FUNCTIONS ==========

// Toggle promo fields visibility
function togglePromoFields() {
    const enabled = document.getElementById('promo-enabled').checked;
    const promoFields = document.getElementById('promo-fields');
    promoFields.style.display = enabled ? 'block' : 'none';
    
    if (!enabled) {
        document.getElementById('promo-price').value = '';
        document.getElementById('promo-start').value = '';
        document.getElementById('promo-end').value = '';
    }
}

// Toggle promo date fields visibility
function togglePromoDateFields() {
    const promoType = document.getElementById('promo-type').value;
    const dateFields = document.getElementById('promo-date-fields');
    dateFields.style.display = promoType === 'timed' ? 'block' : 'none';
    
    if (promoType === 'permanent') {
        document.getElementById('promo-start').value = '';
        document.getElementById('promo-end').value = '';
    }
}

// ========== PROMO CODE FUNCTIONS ==========

// Load promo codes
async function loadPromoCodes() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/promo-codes`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            console.error('Session expired. Please login again.');
            window.location.href = `${BASE_PATH}/login`;
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to load promo codes');
        }
        
        promoCodes = await response.json();
        renderPromoCodes();
        updatePromoCodeCategoryDropdown();
    } catch (error) {
        console.error('Error loading promo codes:', error);
    }
}

// Update promo code category dropdown
function updatePromoCodeCategoryDropdown() {
    const select = document.getElementById('promo-code-category');
    const categories = [...new Set(products.map(p => p.category))].sort();
    
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Categories</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
    });
    
    if (currentValue && (currentValue === 'all' || categories.includes(currentValue))) {
        select.value = currentValue;
    }
}

// Render promo codes table
function renderPromoCodes() {
    const tbody = document.getElementById('promo-codes-table-body');
    
    if (promoCodes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #999;">
                    No promo codes yet. Create one above!
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = promoCodes.map(promo => `
        <tr>
            <td data-label="Code">
                <strong style="font-family: monospace; color: #667eea;">${promo.code}</strong>
            </td>
            <td data-label="Category">
                <span class="product-category">${promo.category === 'all' ? 'All Categories' : promo.category}</span>
            </td>
            <td data-label="Discount">
                <strong style="color: #e74c3c;">${promo.discount}% OFF</strong>
            </td>
            <td data-label="Status">
                <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; 
                       background: ${promo.isActive ? '#d4edda' : '#f8d7da'}; 
                       color: ${promo.isActive ? '#155724' : '#721c24'};">
                    ${promo.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
            </td>
            <td data-label="Actions">
                <div class="product-actions">
                    <button onclick="editPromoCode(${promo.id})" class="btn btn-primary btn-small">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="deletePromoCode(${promo.id})" class="btn btn-danger btn-small">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Save promo code (add or edit)
async function savePromoCode() {
    const code = document.getElementById('promo-code-input').value.trim().toUpperCase();
    const category = document.getElementById('promo-code-category').value;
    const discount = parseFloat(document.getElementById('promo-code-discount').value);
    const isActive = document.getElementById('promo-code-active').value === 'true';
    
    if (!code) {
        alert('Please enter a promo code');
        return;
    }
    
    if (!discount || discount < 1 || discount > 100) {
        alert('Please enter a discount between 1 and 100%');
        return;
    }
    
    const promoData = {
        code,
        category,
        discount,
        isActive
    };
    
    try {
        const token = sessionStorage.getItem('adminToken');
        let response;
        
        if (editingPromoId) {
            // Update existing promo code
            response = await fetch(`${API_URL}/promo-codes/${editingPromoId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(promoData)
            });
        } else {
            // Add new promo code
            response = await fetch(`${API_URL}/promo-codes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(promoData)
            });
        }
        
        if (response.ok) {
            alert(editingPromoId ? 'Promo code updated successfully!' : 'Promo code added successfully!');
            resetPromoForm();
            loadPromoCodes();
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to save promo code');
        }
    } catch (error) {
        console.error('Error saving promo code:', error);
        alert('Error saving promo code');
    }
}

// Edit promo code
function editPromoCode(id) {
    const promo = promoCodes.find(p => p.id === id);
    if (!promo) return;
    
    editingPromoId = id;
    
    document.getElementById('promo-code-input').value = promo.code;
    document.getElementById('promo-code-category').value = promo.category;
    document.getElementById('promo-code-discount').value = promo.discount;
    document.getElementById('promo-code-active').value = promo.isActive.toString();
    
    document.getElementById('promo-submit-text').textContent = 'Update Promo Code';
    document.getElementById('cancel-promo-btn').style.display = 'inline-flex';
    
    // Scroll to form
    document.querySelector('.admin-section h2').scrollIntoView({ behavior: 'smooth' });
}

// Delete promo code
async function deletePromoCode(id) {
    if (!confirm('Are you sure you want to delete this promo code?')) {
        return;
    }
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/promo-codes/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            alert('Promo code deleted successfully!');
            loadPromoCodes();
        } else {
            alert('Failed to delete promo code');
        }
    } catch (error) {
        console.error('Error deleting promo code:', error);
        alert('Error deleting promo code');
    }
}

// Reset promo code form
function resetPromoForm() {
    editingPromoId = null;
    document.getElementById('promo-code-input').value = '';
    document.getElementById('promo-code-category').value = 'all';
    document.getElementById('promo-code-discount').value = '';
    document.getElementById('promo-code-active').value = 'true';
    document.getElementById('promo-submit-text').textContent = 'Add Promo Code';
    document.getElementById('cancel-promo-btn').style.display = 'none';
}

// Cancel promo code edit
function cancelPromoEdit() {
    resetPromoForm();
}

// ========== CATEGORY MANAGEMENT FUNCTIONS ==========

let editingCategoryName = null;
let categories = [];

// Load categories
async function loadCategories() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/categories`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            console.error('Session expired. Please login again.');
            window.location.href = `${BASE_PATH}/login`;
            return;
        }
        
        if (!response.ok) {
            throw new Error('Failed to load categories');
        }
        
        categories = await response.json();
        renderCategories();
        updateBulkAssignDropdown();
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Render categories table
function renderCategories() {
    const tbody = document.getElementById('categories-table-body');
    
    if (!tbody) {
        console.error('Categories table body not found');
        return;
    }
    
    if (!categories || categories.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px; color: #999;">
                    No categories yet. They will appear as you add products.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = categories.map(cat => `
        <tr>
            <td data-label="English Name"><strong>${escapeHtml(cat.en)}</strong></td>
            <td data-label="Bulgarian Name">${escapeHtml(cat.bg)}</td>
            <td data-label="Products Count">
                <span style="background: #e8f5e9; color: #2e7d32; padding: 4px 8px; border-radius: 4px; font-weight: 600;">
                    ${cat.count} ${cat.count === 1 ? 'product' : 'products'}
                </span>
            </td>
            <td data-label="Actions">
                <div class="product-actions">
                    <button onclick="editCategory('${escapeHtml(cat.en)}')" class="btn btn-primary btn-small">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button onclick="deleteCategory('${escapeHtml(cat.en)}')" class="btn btn-danger btn-small">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Save category (add or update)
async function saveCategory() {
    const enName = document.getElementById('category-name-en').value.trim();
    const bgName = document.getElementById('category-name-bg').value.trim();
    
    if (!enName) {
        alert('Please enter an English category name');
        return;
    }
    
    try {
        const token = sessionStorage.getItem('adminToken');
        
        if (editingCategoryName) {
            // Update existing category
            const response = await fetch(`${API_URL}/categories/${encodeURIComponent(editingCategoryName)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ en: enName, bg: bgName || enName })
            });
            
            if (response.ok) {
                alert('Category updated successfully!');
                resetCategoryForm();
                await Promise.all([loadCategories(), loadProducts()]);
            } else {
                alert('Failed to update category');
            }
        } else {
            // Adding a new category is implicit - just inform user
            alert('Category will be created when you assign products to it using the form above or bulk assign below.');
            resetCategoryForm();
        }
    } catch (error) {
        console.error('Error saving category:', error);
        alert('Error saving category');
    }
}

// Edit category
function editCategory(categoryName) {
    const category = categories.find(c => c.en === categoryName);
    if (!category) return;
    
    editingCategoryName = categoryName;
    
    document.getElementById('category-name-en').value = category.en;
    document.getElementById('category-name-bg').value = category.bg;
    
    document.getElementById('category-submit-text').textContent = 'Update Category';
    document.getElementById('cancel-category-btn').style.display = 'inline-flex';
    
    // Scroll to form
    document.querySelector('.admin-section h2').scrollIntoView({ behavior: 'smooth' });
}

// Delete category
async function deleteCategory(categoryName) {
    const category = categories.find(c => c.en === categoryName);
    if (!category) return;
    
    if (category.count > 0) {
        // Need to reassign products
        const reassignTo = prompt(`This category has ${category.count} product(s). Enter the category name to reassign them to:`);
        if (!reassignTo) return;
        
        try {
            const token = sessionStorage.getItem('adminToken');
            const response = await fetch(`${API_URL}/categories/${encodeURIComponent(categoryName)}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reassignTo })
            });
            
            if (response.ok) {
                alert(`Category deleted and ${category.count} product(s) reassigned to "${reassignTo}"`);
                await Promise.all([loadCategories(), loadProducts()]);
            } else {
                alert('Failed to delete category');
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Error deleting category');
        }
    } else {
        alert('Category has no products and will disappear automatically.');
    }
}

// Reset category form
function resetCategoryForm() {
    editingCategoryName = null;
    document.getElementById('category-name-en').value = '';
    document.getElementById('category-name-bg').value = '';
    document.getElementById('category-submit-text').textContent = 'Add Category';
    document.getElementById('cancel-category-btn').style.display = 'none';
}

// Cancel category edit
function cancelCategoryEdit() {
    resetCategoryForm();
}

// Update bulk assign category dropdown
function updateBulkAssignDropdown() {
    const select = document.getElementById('bulk-assign-category');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="">Select category...</option>';
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.en;
        option.textContent = `${cat.en} (${cat.bg})`;
        option.dataset.bg = cat.bg;
        select.appendChild(option);
    });
    
    // Allow creating new category
    const newOption = document.createElement('option');
    newOption.value = '__NEW__';
    newOption.textContent = '+ Create New Category';
    select.appendChild(newOption);
    
    if (currentValue && categories.find(c => c.en === currentValue)) {
        select.value = currentValue;
    }
}

// Bulk assign products to category
async function bulkAssignCategory() {
    const select = document.getElementById('bulk-assign-category');
    let categoryEn = select.value;
    
    if (!categoryEn) {
        alert('Please select a category');
        return;
    }
    
    const ids = Array.from(manageSelected);
    if (ids.length === 0) {
        alert('Please select at least one product from the Manage Products section');
        return;
    }
    
    let categoryBg = '';
    
    if (categoryEn === '__NEW__') {
        // Create new category
        categoryEn = prompt('Enter new category name (English):');
        if (!categoryEn) return;
        categoryBg = prompt('Enter new category name (Bulgarian, optional):') || categoryEn;
    } else {
        // Get BG name from selected option
        const selectedOption = select.options[select.selectedIndex];
        categoryBg = selectedOption.dataset.bg || categoryEn;
    }
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/products/category/bulk-assign`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ ids, category: categoryEn, categoryBg })
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(`${result.updated} product(s) assigned to category "${categoryEn}"`);
            await Promise.all([loadCategories(), loadProducts()]);
            manageSelected.clear();
            updateManageSelectionUI();
        } else {
            alert('Failed to assign products to category');
        }
    } catch (error) {
        console.error('Error bulk assigning category:', error);
        alert('Error assigning products to category');
    }
}

// ==================== ORDERS MANAGEMENT ====================

let orders = [];
let ordersCheckInterval = null;

// Load and display orders
async function loadOrders() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/orders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            orders = await response.json();
            renderPendingOrders();
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

// Render pending orders at the top
function renderPendingOrders() {
    const pendingOrders = orders
        .filter(order => order.status === 'pending')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const section = document.getElementById('pending-orders-section');
    const badge = document.getElementById('pending-count-badge');
    const list = document.getElementById('pending-orders-list');

    if (pendingOrders.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    badge.textContent = pendingOrders.length;

    list.innerHTML = pendingOrders.map(order => {
        const orderDate = new Date(order.timestamp);
        const formattedDate = orderDate.toLocaleDateString('bg-BG', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const formattedTime = orderDate.toLocaleTimeString('bg-BG', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const deliveryIcon = order.deliveryMethod === 'delivery' 
            ? '<i class="fas fa-truck"></i> Доставка' 
            : '<i class="fas fa-shopping-bag"></i> Взимане';

        const itemsList = order.items.map(item => `
            <div class="order-item">
                <span class="order-item-name">${item.name}</span>
                <div class="order-item-details">
                    <span>x${item.quantity}</span>
                    <span>${(item.price * item.quantity).toFixed(2)} лв</span>
                </div>
            </div>
        `).join('');

        return `
            <div class="order-card">
                <div class="order-header">
                    <div>
                        <div class="order-id">Поръчка #${order.id}</div>
                        <div class="order-time">${formattedDate} в ${formattedTime}</div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <span class="delivery-badge ${order.deliveryMethod}">${deliveryIcon}</span>
                        <span class="order-status ${order.status}">${order.status}</span>
                    </div>
                </div>
                
                <div class="order-body">
                    <div class="order-section">
                        <h4><i class="fas fa-user"></i> Информация за Клиента</h4>
                        <div class="order-info-row">
                            <span class="order-info-label">Име:</span>
                            <span class="order-info-value">${order.customerInfo.name}</span>
                        </div>
                        <div class="order-info-row">
                            <span class="order-info-label">Телефон:</span>
                            <span class="order-info-value">
                                <a href="tel:${order.customerInfo.phone}" style="color: #e74c3c; text-decoration: none; font-weight: 600;">
                                    ${order.customerInfo.phone}
                                </a>
                            </span>
                        </div>
                        <div class="order-info-row">
                            <span class="order-info-label">Имейл:</span>
                            <span class="order-info-value">
                                <a href="mailto:${order.customerInfo.email}" style="color: #3498db; text-decoration: none;">
                                    ${order.customerInfo.email}
                                </a>
                            </span>
                        </div>
                        ${order.deliveryMethod === 'delivery' ? `
                        <div class="order-info-row">
                            <span class="order-info-label">Адрес:</span>
                            <span class="order-info-value">${order.customerInfo.address}</span>
                        </div>
                        ` : ''}
                        ${order.customerInfo.notes ? `
                        <div class="order-info-row">
                            <span class="order-info-label">Бележки:</span>
                            <span class="order-info-value">${order.customerInfo.notes}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="order-section">
                        <h4><i class="fas fa-shopping-cart"></i> Поръчани Продукти</h4>
                        <div class="order-items">
                            ${itemsList}
                        </div>
                        ${order.promoCode ? `
                        <div class="order-info-row" style="margin-top: 10px; color: #27ae60;">
                            <span class="order-info-label">Промо код:</span>
                            <span class="order-info-value">${order.promoCode} (-${order.discount}%)</span>
                        </div>
                        ` : ''}
                        ${order.deliveryFee && order.deliveryFee > 0 ? `
                        <div class="order-info-row" style="margin-top: 10px;">
                            <span class="order-info-label">Такса доставка:</span>
                            <span class="order-info-value">${order.deliveryFee.toFixed(2)} лв</span>
                        </div>
                        ` : ''}
                        ${order.deliveryMethod === 'delivery' && (!order.deliveryFee || order.deliveryFee === 0) ? `
                        <div class="order-info-row" style="margin-top: 10px; color: #27ae60;">
                            <span class="order-info-label">Безплатна доставка!</span>
                            <span class="order-info-value">0.00 лв</span>
                        </div>
                        ` : ''}
                        ${order.ownerDiscount && order.ownerDiscount > 0 ? `
                        <div class="order-info-row" style="margin-top: 10px; color: #e67e22;">
                            <span class="order-info-label">Отстъпка от собственик:</span>
                            <span class="order-info-value">-${order.ownerDiscountAmount.toFixed(2)} лв (${order.ownerDiscount}%)</span>
                        </div>
                        ` : ''}
                        <div class="order-total">
                            <span class="order-total-label">Обща Сума:</span>
                            <span class="order-total-value">${order.total.toFixed(2)} лв</span>
                        </div>
                        ${order.ownerDiscount && order.ownerDiscount > 0 ? `
                        <div class="order-total" style="margin-top: 5px; color: #27ae60;">
                            <span class="order-total-label">Финална Сума:</span>
                            <span class="order-total-value">${order.finalTotal.toFixed(2)} лв</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="order-actions">
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        ${order.status === 'pending' ? `
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <label for="discount-${order.id}" style="font-size: 14px; white-space: nowrap;">Отстъпка (%):</label>
                            <input type="number" id="discount-${order.id}" min="0" max="100" step="1" value="0" 
                                   style="width: 70px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <button onclick="updateOrderStatus(${order.id}, 'confirmed')" class="btn btn-success">
                            <i class="fas fa-check"></i> Потвърди Поръчка
                        </button>
                        <button onclick="updateOrderStatus(${order.id}, 'cancelled')" class="btn btn-danger">
                            <i class="fas fa-times"></i> Откажи Поръчка
                        </button>
                        ` : ''}
                        <button onclick="deleteOrder(${order.id})" class="btn btn-secondary">
                            <i class="fas fa-trash"></i> Изтрий
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Play notification sound if there are new pending orders
    if (pendingOrders.length > 0) {
        playNotificationSound();
    }
}

// Update order status
async function updateOrderStatus(orderId, status) {
    // Get the owner discount if confirming
    let ownerDiscount = 0;
    if (status === 'confirmed') {
        const discountInput = document.getElementById(`discount-${orderId}`);
        ownerDiscount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
        
        if (ownerDiscount < 0 || ownerDiscount > 100) {
            alert('Отстъпката трябва да е между 0% и 100%');
            return;
        }
    }
    
    const confirmMessage = status === 'confirmed' && ownerDiscount > 0
        ? `Сигурни ли сте, че искате да потвърдите тази поръчка с ${ownerDiscount}% отстъпка?`
        : `Сигурни ли сте, че искате да ${status === 'confirmed' ? 'потвърдите' : 'откажете'} тази поръчка?`;
    
    if (!confirm(confirmMessage)) {
        return;
    }

    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                status,
                ownerDiscount: ownerDiscount
            })
        });

        if (response.ok) {
            const successMessage = status === 'confirmed' && ownerDiscount > 0
                ? `Поръчката е потвърдена с ${ownerDiscount}% отстъпка успешно!`
                : `Поръчката е ${status === 'confirmed' ? 'потвърдена' : 'отказана'} успешно!`;
            alert(successMessage);
            await loadOrders();
        } else {
            alert('Грешка при актуализиране на поръчката');
        }
    } catch (error) {
        console.error('Error updating order status:', error);
        alert('Грешка при актуализиране на поръчката');
    }
}

// Delete order
async function deleteOrder(orderId) {
    if (!confirm('Сигурни ли сте, че искате да изтриете тази поръчка?')) {
        return;
    }

    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            alert('Поръчката е изтрита успешно!');
            await loadOrders();
        } else {
            alert('Грешка при изтриване на поръчката');
        }
    } catch (error) {
        console.error('Error deleting order:', error);
        alert('Грешка при изтриване на поръчката');
    }
}

// Play notification sound
function playNotificationSound() {
    // Create a simple beep sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
        console.log('Audio notification not supported');
    }
}

// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// Show browser notification
function showBrowserNotification(order) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Нова Поръчка!', {
            body: `Поръчка #${order.id} от ${order.customerInfo.name}\nОбща сума: ${order.total.toFixed(2)} лв`,
            icon: '/favicon.ico',
            tag: `order-${order.id}`
        });

        notification.onclick = function() {
            window.focus();
            notification.close();
        };
    }
}

// Check for new orders periodically
function startOrdersPolling() {
    // Load orders immediately
    loadOrders();
    
    // Request notification permission
    requestNotificationPermission();

    // Check for new orders every 30 seconds
    ordersCheckInterval = setInterval(async () => {
        const oldOrdersCount = orders.filter(o => o.status === 'pending').length;
        await loadOrders();
        const newOrdersCount = orders.filter(o => o.status === 'pending').length;

        // If there are new pending orders, show notification
        if (newOrdersCount > oldOrdersCount) {
            const newOrders = orders.filter(o => o.status === 'pending').slice(0, newOrdersCount - oldOrdersCount);
            newOrders.forEach(order => showBrowserNotification(order));
        }
    }, 30000); // 30 seconds
}

// Stop orders polling
function stopOrdersPolling() {
    if (ordersCheckInterval) {
        clearInterval(ordersCheckInterval);
        ordersCheckInterval = null;
    }
}

// Initialize orders management when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (checkAuth()) {
        startOrdersPolling();
        loadCurrencySettings();
        loadWorkingHours();
        initializeZonesMap();
    }
});

// Stop polling when page unloads
window.addEventListener('beforeunload', function() {
    stopOrdersPolling();
});

// ==================== DELIVERY SETTINGS ====================

// Load delivery settings
async function loadDeliverySettings() {
    try {
        const response = await fetch(`${API_URL}/settings/delivery`);
        if (response.ok) {
            const settings = await response.json();
            
            document.getElementById('free-delivery-enabled').checked = settings.freeDeliveryEnabled || false;
            document.getElementById('free-delivery-amount').value = settings.freeDeliveryAmount || 50;
            document.getElementById('delivery-fee').value = settings.deliveryFee || 5;
            
            toggleFreeDelivery();
        }
    } catch (error) {
        console.error('Error loading delivery settings:', error);
    }
}

// Toggle free delivery amount field
function toggleFreeDelivery() {
    const enabled = document.getElementById('free-delivery-enabled').checked;
    const amountGroup = document.getElementById('free-delivery-amount-group');
    
    if (enabled) {
        amountGroup.style.display = 'block';
    } else {
        amountGroup.style.display = 'none';
    }
}

// Save delivery settings
async function saveDeliverySettings() {
    const freeDeliveryEnabled = document.getElementById('free-delivery-enabled').checked;
    const freeDeliveryAmount = parseFloat(document.getElementById('free-delivery-amount').value) || 50;
    const deliveryFee = parseFloat(document.getElementById('delivery-fee').value) || 5;

    const settings = {
        freeDeliveryEnabled,
        freeDeliveryAmount,
        deliveryFee
    };

    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/settings/delivery`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            alert('Delivery settings saved successfully!');
        } else {
            alert('Failed to save delivery settings');
        }
    } catch (error) {
        console.error('Error saving delivery settings:', error);
        alert('Error saving delivery settings');
    }
}

// ==================== COMBO & BUNDLE OFFERS ====================

let selectedComboProducts = new Set();
let allComboProducts = [];
let comboCurrentPage = 1;
let comboItemsPerPage = 10;
let comboFilteredProducts = [];

// Load products for combo selector
async function loadProductsForCombo() {
    try {
        const response = await fetch(`${API_URL}/products`);
        if (response.ok) {
            allComboProducts = await response.json();
            comboFilteredProducts = allComboProducts;
            comboCurrentPage = 1;
            populateComboCategoryFilter();
            renderComboProductSelector();
            setupComboFilters();
            loadCombos();
        }
    } catch (error) {
        console.error('Error loading products for combo:', error);
    }
}

// Populate category filter dropdown
function populateComboCategoryFilter() {
    const select = document.getElementById('combo-category-filter');
    if (!select) return;
    
    const categories = [...new Set(allComboProducts.map(p => p.category))];
    select.innerHTML = '<option value="">All Categories</option>' + 
        categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

// Setup combo filters (search and category)
function setupComboFilters() {
    const searchInput = document.getElementById('combo-product-search');
    const categoryFilter = document.getElementById('combo-category-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterComboProducts);
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterComboProducts);
    }
}

// Filter combo products
function filterComboProducts() {
    const searchTerm = document.getElementById('combo-product-search').value.toLowerCase();
    const selectedCategory = document.getElementById('combo-category-filter').value;
    
    let filtered = allComboProducts;
    
    // Filter by category
    if (selectedCategory) {
        filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(p => 
            p.name.toLowerCase().includes(searchTerm) || 
            (p.nameBg && p.nameBg.toLowerCase().includes(searchTerm)) ||
            String(p.id).includes(searchTerm)
        );
    }
    
    comboFilteredProducts = filtered;
    comboCurrentPage = 1;
    renderComboProductSelector();
}

// Render product selector for combo creation with pagination
function renderComboProductSelector() {
    const container = document.getElementById('combo-products-selector');
    const pageInfo = document.getElementById('combo-page-info');
    if (!container) return;
    
    const products = comboFilteredProducts.length > 0 ? comboFilteredProducts : allComboProducts;
    
    if (products.length === 0) {
        container.innerHTML = '<p style="color: #999; text-align: center;">No products found.</p>';
        if (pageInfo) pageInfo.textContent = 'Page 0 of 0';
        return;
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(products.length / comboItemsPerPage);
    const startIndex = (comboCurrentPage - 1) * comboItemsPerPage;
    const endIndex = startIndex + comboItemsPerPage;
    const pageProducts = products.slice(startIndex, endIndex);
    
    // Grid layout with cards
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px;">
            ${pageProducts.map(product => `
                <label style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border: 2px solid ${selectedComboProducts.has(product.id) ? '#4CAF50' : '#e0e0e0'};
                    border-radius: 8px;
                    cursor: pointer;
                    background: ${selectedComboProducts.has(product.id) ? '#f1f8f4' : 'white'};
                    transition: all 0.2s;
                    &:hover {
                        border-color: #4CAF50;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    }
                ">
                    <input type="checkbox" 
                           value="${product.id}" 
                           ${selectedComboProducts.has(product.id) ? 'checked' : ''}
                           onchange="toggleComboProduct(${product.id})"
                           style="cursor: pointer; width: 18px; height: 18px;">
                    <img src="${product.image}" 
                         alt="${product.name}" 
                         style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; flex-shrink: 0;">
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 500; font-size: 14px; color: #333; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${product.name}</div>
                        <div style="font-size: 13px; color: #4CAF50; font-weight: 600;">${product.price.toFixed(2)} лв</div>
                    </div>
                </label>
            `).join('')}
        </div>
    `;
    
    // Update page info
    if (pageInfo) {
        pageInfo.textContent = `Page ${comboCurrentPage} of ${totalPages} (${products.length} products)`;
    }
}

// Pagination functions
function previousComboPage() {
    if (comboCurrentPage > 1) {
        comboCurrentPage--;
        renderComboProductSelector();
    }
}

function nextComboPage() {
    const products = comboFilteredProducts.length > 0 ? comboFilteredProducts : allComboProducts;
    const totalPages = Math.ceil(products.length / comboItemsPerPage);
    if (comboCurrentPage < totalPages) {
        comboCurrentPage++;
        renderComboProductSelector();
    }
}

// Toggle product selection for combo
function toggleComboProduct(productId) {
    if (selectedComboProducts.has(productId)) {
        selectedComboProducts.delete(productId);
    } else {
        selectedComboProducts.add(productId);
    }
}

// Save combo/bundle
async function saveCombo() {
    const name = document.getElementById('combo-name').value.trim();
    const nameBg = document.getElementById('combo-name-bg').value.trim();
    const description = document.getElementById('combo-description').value.trim();
    const descriptionBg = document.getElementById('combo-description-bg').value.trim();
    const price = parseFloat(document.getElementById('combo-price').value);
    const type = document.getElementById('combo-type').value;
    const image = document.getElementById('combo-image').value.trim();
    
    if (!name || !price || price <= 0) {
        alert('Please fill in combo name and valid price!');
        return;
    }
    
    if (selectedComboProducts.size === 0) {
        alert('Please select at least one product for this combo!');
        return;
    }
    
    const comboProduct = {
        name: name,
        nameBg: nameBg || name,
        description: description || 'Special combo offer',
        descriptionBg: descriptionBg || description || 'Специална комбо оферта',
        price: price,
        category: 'Combos & Bundles',
        categoryBg: 'Комбо и Бъндъл Оферти',
        image: image || 'https://via.placeholder.com/300x200?text=Combo+Offer',
        isCombo: true,
        comboType: type,
        comboProducts: Array.from(selectedComboProducts)
    };
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(comboProduct)
        });
        
        if (response.ok) {
            alert('Combo/Bundle created successfully!');
            clearComboForm();
            loadProductsForCombo();
            loadProducts(); // Refresh main products list
        } else {
            alert('Failed to create combo/bundle');
        }
    } catch (error) {
        console.error('Error creating combo:', error);
        alert('Error creating combo/bundle');
    }
}

// Clear combo form
function clearComboForm() {
    document.getElementById('combo-name').value = '';
    document.getElementById('combo-name-bg').value = '';
    document.getElementById('combo-description').value = '';
    document.getElementById('combo-description-bg').value = '';
    document.getElementById('combo-price').value = '';
    document.getElementById('combo-image').value = '';
    document.getElementById('combo-type').value = 'combo';
    selectedComboProducts.clear();
    
    // Uncheck all checkboxes
    const checkboxes = document.querySelectorAll('#combo-products-selector input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
}

// Load and display combos
async function loadCombos() {
    try {
        const response = await fetch(`${API_URL}/products`);
        if (response.ok) {
            const products = await response.json();
            const combos = products.filter(p => p.isCombo);
            renderCombosTable(combos);
        }
    } catch (error) {
        console.error('Error loading combos:', error);
    }
}

// Render combos table
function renderCombosTable(combos) {
    const tbody = document.getElementById('combos-table-body');
    if (!tbody) return;
    
    if (combos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 20px; color: #999;">
                    No combos or bundles yet. Create one above!
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = combos.map(combo => `
        <tr>
            <td><img src="${combo.image}" alt="${combo.name}" class="product-img-thumb"></td>
            <td>${combo.name}</td>
            <td><span style="padding: 4px 8px; background: #3498db; color: white; border-radius: 4px; font-size: 12px;">
                ${combo.comboType === 'bundle' ? 'Bundle' : 'Combo'}
            </span></td>
            <td>${combo.price.toFixed(2)} лв</td>
            <td>
                <button onclick="deleteProduct(${combo.id})" class="btn btn-danger btn-sm">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

// ==================== BUNDLE CREATION FROM MANAGE PRODUCTS ====================

// Open bundle creation modal
function openBundleModal() {
    const selectedIds = Array.from(manageSelected);
    if (selectedIds.length < 2) {
        alert('Please select at least 2 products to create a bundle.');
        return;
    }
    
    const selectedProducts = products.filter(p => selectedIds.includes(p.id));
    
    // Display selected products
    const productsList = document.getElementById('bundle-products-list');
    productsList.innerHTML = `
        <h4 style="margin-bottom: 10px;">Selected Products:</h4>
        ${selectedProducts.map(p => `
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: white; border-radius: 4px; margin-bottom: 5px;">
                <img src="${p.image}" alt="${p.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                <div style="flex: 1;">
                    <strong>${p.name}</strong>
                    <div style="color: #666; font-size: 14px;">${p.price.toFixed(2)} лв</div>
                </div>
            </div>
        `).join('')}
    `;
    
    // Auto-generate bundle name
    const autoName = selectedProducts.map(p => p.name).join(' + ');
    const autoNameBg = selectedProducts.map(p => p.nameBg || p.name).join(' + ');
    document.getElementById('bundle-name-input').value = autoName;
    document.getElementById('bundle-name-bg-input').value = autoNameBg;
    
    // Calculate total original price
    const totalPrice = selectedProducts.reduce((sum, p) => sum + p.price, 0);
    document.getElementById('bundle-original-price').textContent = `Original total: ${totalPrice.toFixed(2)} лв`;
    document.getElementById('bundle-price-input').value = (totalPrice * 0.85).toFixed(2); // Suggest 15% discount
    
    // Clear other fields
    document.getElementById('bundle-label-input').value = 'SPECIAL';
    document.getElementById('bundle-image-input').value = selectedProducts[0].image;
    
    // Show modal
    document.getElementById('bundle-modal').style.display = 'flex';
}

// Close bundle modal
function closeBundleModal() {
    document.getElementById('bundle-modal').style.display = 'none';
}

// Confirm bundle creation
async function confirmBundleCreation() {
    const selectedIds = Array.from(manageSelected);
    const selectedProducts = products.filter(p => selectedIds.includes(p.id));
    
    const name = document.getElementById('bundle-name-input').value.trim();
    const nameBg = document.getElementById('bundle-name-bg-input').value.trim();
    const price = parseFloat(document.getElementById('bundle-price-input').value);
    const label = document.getElementById('bundle-label-input').value.trim();
    const image = document.getElementById('bundle-image-input').value.trim();
    
    if (!name || !price || price <= 0) {
        alert('Please provide a bundle name and valid price!');
        return;
    }
    
    // Create bundle description
    const description = `Bundle includes: ${selectedProducts.map(p => p.name).join(', ')}`;
    const descriptionBg = `Бъндълът включва: ${selectedProducts.map(p => p.nameBg || p.name).join(', ')}`;
    
    const bundleProduct = {
        name: name,
        nameBg: nameBg || name,
        description: description,
        descriptionBg: descriptionBg,
        price: price,
        category: 'Combos & Bundles',
        categoryBg: 'Комбо и Бъндъл Оферти',
        image: image || selectedProducts[0].image,
        isCombo: true,
        comboType: 'bundle',
        comboProducts: selectedIds,
        specialLabel: label || null
    };
    
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(bundleProduct)
        });
        
        if (response.ok) {
            alert('Bundle created successfully!');
            closeBundleModal();
            manageSelected.clear();
            document.getElementById('manage-select-all').checked = false;
            await loadProducts();
            loadCombos();
        } else {
            alert('Failed to create bundle');
        }
    } catch (error) {
        console.error('Error creating bundle:', error);
        alert('Error creating bundle');
    }
}



// ==================== City Delivery Prices Management ====================

let cities = [];

async function loadCities() {
    try {
        const response = await fetch(`${API_URL}/settings/delivery`);
        const data = await response.json();
        
        if (data && data.cityPrices) {
            cities = Object.entries(data.cityPrices).map(([name, price]) => ({ name, price }));
        } else {
            cities = [];
        }
        
        renderCities();
    } catch (error) {
        console.error('Error loading cities:', error);
    }
}

function renderCities() {
    const citiesList = document.getElementById('cities-list');
    
    if (!citiesList) return;
    
    if (cities.length === 0) {
        citiesList.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">No cities added yet. Add your first city above.</p>`;
        return;
    }
    
    citiesList.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">City Name</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Delivery Price (EUR)</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${cities.map((city, index) => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px;">${city.name}</td>
                        <td style="padding: 12px; text-align: center;">${parseFloat(city.price).toFixed(2)} EUR</td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="editCity(${index})" class="btn btn-sm" style="padding: 5px 10px; margin-right: 5px;">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button onclick="deleteCity(${index})" class="btn btn-sm btn-danger" style="padding: 5px 10px;">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

async function addCity() {
    const nameInput = document.getElementById('city-name-input');
    const priceInput = document.getElementById('city-price-input');
    
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    
    if (!name) {
        alert('Please enter a city name');
        return;
    }
    
    if (isNaN(price) || price < 0) {
        alert('Please enter a valid price');
        return;
    }
    
    // Check if city already exists
    if (cities.some(c => c.name === name)) {
        alert(`City "${name}" already exists`);
        return;
    }
    
    cities.push({ name, price });
    
    await saveCities();
    
    nameInput.value = '';
    priceInput.value = '';
}

function editCity(index) {
    const city = cities[index];
    
    const newName = prompt('Enter new city name:', city.name);
    if (!newName || newName.trim() === '') return;
    
    const newPrice = prompt('Enter new delivery price (EUR):', city.price);
    if (newPrice === null) return;
    
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
        alert('Invalid price');
        return;
    }
    
    cities[index] = { name: newName.trim(), price };
    saveCities();
}

function deleteCity(index) {
    const city = cities[index];
    
    if (!confirm(`Are you sure you want to delete "${city.name}"?`)) {
        return;
    }
    
    cities.splice(index, 1);
    saveCities();
}

async function saveCities() {
    try {
        const token = sessionStorage.getItem('adminToken');
        
        // Get current delivery settings first
        const getResponse = await fetch(`${API_URL}/settings/delivery`);
        let settings = {};
        if (getResponse.ok) {
            settings = await getResponse.json();
        }
        
        // Convert cities array to object
        const cityPrices = {};
        cities.forEach(city => {
            cityPrices[city.name] = city.price;
        });
        
        // Update only cityPrices, keep other settings
        settings.cityPrices = cityPrices;
        
        const response = await fetch(`${API_URL}/settings/delivery`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(settings)
        });
        
        if (response.ok) {
            renderCities();
            alert('Cities saved successfully!');
        } else {
            alert('Failed to save cities');
        }
    } catch (error) {
        console.error('Error saving cities:', error);
        alert('Error saving cities');
    }
}
