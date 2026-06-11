// IndexedDB para el carrito de compras
const CART_DB_NAME = 'DestellosLVCart';
const CART_DB_VERSION = 1;
const CART_STORE_NAME = 'cart';

let db = null;

// Inicializar la base de datos
function initCartDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(CART_DB_NAME, CART_DB_VERSION);

        request.onerror = (event) => {
            console.error('Error al abrir IndexedDB:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains(CART_STORE_NAME)) {
                const store = db.createObjectStore(CART_STORE_NAME, { keyPath: 'id' });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('price', 'price', { unique: false });
            }
        };
    });
}

// Obtener todos los items del carrito
async function getCartItems() {
    await initCartDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CART_STORE_NAME], 'readonly');
        const store = transaction.objectStore(CART_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result || []);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Agregar item al carrito
async function addToCart(product, quantity = 1) {
    await initCartDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CART_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CART_STORE_NAME);
        
        const getRequest = store.get(product.id);
        
        getRequest.onsuccess = () => {
            const existingItem = getRequest.result;
            
            if (existingItem) {
                existingItem.quantity += quantity;
                const updateRequest = store.put(existingItem);
                
                updateRequest.onsuccess = () => {
                    resolve(existingItem);
                    dispatchCartUpdateEvent();
                };
                
                updateRequest.onerror = (event) => {
                    reject(event.target.error);
                };
            } else {
                const cartItem = {
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    originalPrice: product.originalPrice,
                    image: product.image,
                    category: product.category,
                    tagline: product.tagline,
                    quantity: quantity
                };
                
                const addRequest = store.add(cartItem);
                
                addRequest.onsuccess = () => {
                    resolve(cartItem);
                    dispatchCartUpdateEvent();
                };
                
                addRequest.onerror = (event) => {
                    reject(event.target.error);
                };
            }
        };
        
        getRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Actualizar cantidad de un item
async function updateCartItemQuantity(productId, newQuantity) {
    await initCartDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CART_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CART_STORE_NAME);
        
        const getRequest = store.get(productId);
        
        getRequest.onsuccess = () => {
            const item = getRequest.result;
            
            if (item) {
                if (newQuantity <= 0) {
                    const deleteRequest = store.delete(productId);
                    
                    deleteRequest.onsuccess = () => {
                        resolve(null);
                        dispatchCartUpdateEvent();
                    };
                    
                    deleteRequest.onerror = (event) => {
                        reject(event.target.error);
                    };
                } else {
                    item.quantity = newQuantity;
                    const updateRequest = store.put(item);
                    
                    updateRequest.onsuccess = () => {
                        resolve(item);
                        dispatchCartUpdateEvent();
                    };
                    
                    updateRequest.onerror = (event) => {
                        reject(event.target.error);
                    };
                }
            } else {
                reject(new Error('Producto no encontrado'));
            }
        };
        
        getRequest.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Eliminar item del carrito
async function removeFromCart(productId) {
    await initCartDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CART_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CART_STORE_NAME);
        const request = store.delete(productId);

        request.onsuccess = () => {
            resolve();
            dispatchCartUpdateEvent();
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Vaciar carrito
async function clearCart() {
    await initCartDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([CART_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(CART_STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            resolve();
            dispatchCartUpdateEvent();
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

// Calcular subtotal
async function calculateSubtotal() {
    const items = await getCartItems();
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Obtener cantidad total de items
async function getTotalItems() {
    const items = await getCartItems();
    return items.reduce((total, item) => total + item.quantity, 0);
}

// Disparar evento de actualización del carrito
function dispatchCartUpdateEvent() {
    const event = new CustomEvent('cartUpdated');
    window.dispatchEvent(event);
}

// Función para renderizar el carrito en el drawer
async function renderCartDrawer() {
    const items = await getCartItems();
    const subtotal = await calculateSubtotal();
    const totalItems = await getTotalItems();
    
    const cartCount = document.getElementById('cartCount');
    if (cartCount) {
        if (totalItems > 0) {
            cartCount.classList.remove('hidden');
            cartCount.textContent = totalItems;
        } else {
            cartCount.classList.add('hidden');
        }
    }
    
    const cartItemsText = document.getElementById('cartItemsText');
    if (cartItemsText) {
        cartItemsText.textContent = `${totalItems} artículo${totalItems !== 1 ? 's' : ''}`;
    }
    
    const cartItemsList = document.getElementById('cartItemsList');
    const emptyCart = document.getElementById('emptyCart');
    const cartFooter = document.getElementById('cartFooter');
    
    if (items.length === 0) {
        cartItemsList.classList.add('hidden');
        emptyCart.classList.remove('hidden');
        cartFooter.classList.add('hidden');
    } else {
        cartItemsList.classList.remove('hidden');
        emptyCart.classList.add('hidden');
        cartFooter.classList.remove('hidden');
        
        cartItemsList.innerHTML = items.map(item => `
            <div class="flex gap-4 py-4 border-b border-border/50 last:border-0">
                <div class="w-20 h-20 rounded-lg overflow-hidden bg-card flex-shrink-0 cursor-pointer" onclick="goToProduct(${item.id})">
                    <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
                </div>
                <div class="flex-1">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-serif text-base text-foreground cursor-pointer hover:text-primary" onclick="goToProduct(${item.id})">${item.name}</h3>
                            <p class="text-xs text-muted-foreground">${item.tagline || ''}</p>
                        </div>
                        <button onclick="removeCartItem(${item.id})" class="text-foreground/40 hover:text-destructive boty-transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                        </button>
                    </div>
                    <div class="flex justify-between items-center mt-2">
                        <div class="flex items-center gap-2">
                            <button onclick="updateQuantity(${item.id}, ${item.quantity - 1})" class="w-6 h-6 rounded-full bg-card flex items-center justify-center text-foreground/60 hover:text-foreground">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
                            </button>
                            <span class="text-sm font-medium text-foreground w-6 text-center">${item.quantity}</span>
                            <button onclick="updateQuantity(${item.id}, ${item.quantity + 1})" class="w-6 h-6 rounded-full bg-card flex items-center justify-center text-foreground/60 hover:text-foreground">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                            </button>
                        </div>
                        <span class="font-medium text-foreground">$${item.price * item.quantity}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    const subtotalElement = document.getElementById('subtotal');
    const totalElement = document.getElementById('total');
    
    if (subtotalElement) subtotalElement.textContent = `$${subtotal}`;
    if (totalElement) totalElement.textContent = `$${subtotal}`;
}

// Funciones globales para el carrito
window.addToCart = async function(product, quantity = 1) {
    try {
        await addToCart(product, quantity);
        openCart();
    } catch (error) {
        console.error('Error al agregar al carrito:', error);
        alert('Error al agregar el producto al carrito');
    }
};

window.removeCartItem = async function(productId) {
    try {
        await removeFromCart(productId);
        await renderCartDrawer();
    } catch (error) {
        console.error('Error al eliminar del carrito:', error);
        alert('Error al eliminar el producto del carrito');
    }
};

window.updateQuantity = async function(productId, newQuantity) {
    try {
        await updateCartItemQuantity(productId, newQuantity);
        await renderCartDrawer();
    } catch (error) {
        console.error('Error al actualizar cantidad:', error);
        alert('Error al actualizar la cantidad');
    }
};

window.clearCart = async function() {
    if (confirm('¿Estás seguro de que quieres vaciar el carrito?')) {
        try {
            await clearCart();
            await renderCartDrawer();
        } catch (error) {
            console.error('Error al vaciar el carrito:', error);
            alert('Error al vaciar el carrito');
        }
    }
};

window.goToProduct = function(id) {
    window.location.href = `product.html?id=${id}`;
};

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    await initCartDB();
    await renderCartDrawer();
    
    window.addEventListener('cartUpdated', async () => {
        await renderCartDrawer();
    });
});