(function () {
    "use strict";

    var cartKey = "tsqh-shop-cart";
    var apiBaseUrl = "http://localhost:3000/api";
    var tokenKey = "tsqh-shop-token";
    var cart = loadCart();
    var cartPanel = document.getElementById("cart-panel");
    var cartBackdrop = document.getElementById("cart-backdrop");
    var cartItems = document.getElementById("cart-items");
    var cartCount = document.getElementById("cart-count");
    var cartTotal = document.getElementById("cart-total");
    var purchaseAccount = document.getElementById("purchase-account");
    var purchaseAccountDetails = document.getElementById("purchase-account-details");

    function loadCart() {
        try {
            var savedCart = JSON.parse(localStorage.getItem(cartKey));
            return Array.isArray(savedCart) ? savedCart : [];
        } catch (error) {
            console.warn("Không thể đọc giỏ hàng đã lưu.", error);
            return [];
        }
    }

    function saveCart() {
        localStorage.setItem(cartKey, JSON.stringify(cart));
    }

    function parsePrice(priceText) {
        var number = Number(String(priceText).replace(/[^\d]/g, ""));
        return Number.isFinite(number) ? number : 0;
    }

    function formatPrice(price) {
        return price.toLocaleString("vi-VN") + "đ";
    }

    async function apiRequest(path, options) {
        var requestOptions = options || {};
        requestOptions.headers = Object.assign(
            { "Content-Type": "application/json" },
            requestOptions.headers || {}
        );
        var token = sessionStorage.getItem(tokenKey);
        if (token) {
            requestOptions.headers.Authorization = "Bearer " + token;
        }

        var response = await fetch(apiBaseUrl + path, requestOptions);
        var payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.message || "Không thể kết nối máy chủ.");
        }
        return payload;
    }

    function showAuthMessage(element, message, isError) {
        element.textContent = message;
        element.className = "form-message " + (isError ? "is-error" : "is-success");
    }

    function getApiError(error) {
        return error instanceof TypeError
            ? "Không thể kết nối máy chủ. Hãy mở cửa sổ lệnh tại C:\\mnquy_05 và chạy: npm start"
            : error.message;
    }

    function renderAccount(user) {
        document.getElementById("account-panel").hidden = !user;
        document.getElementById("login-form").hidden = Boolean(user);
        document.getElementById("register-form").hidden = Boolean(user);
        if (!user) {
            return;
        }

        document.getElementById("account-username").textContent = user.username;
        document.getElementById("account-email").textContent = user.email;
        document.getElementById("account-phone").textContent = user.phone;
        var orders = document.getElementById("account-orders");
        orders.innerHTML = user.orders.length
            ? user.orders.map(function (order) {
                return "<p>" + escapeHtml(order.id) + " - " + escapeHtml(order.status) + "</p>";
            }).join("")
            : "<p>Chưa có đơn hàng.</p>";
    }

    async function loadAccount() {
        if (!sessionStorage.getItem(tokenKey)) {
            return;
        }
        try {
            var result = await apiRequest("/auth/me");
            renderAccount(result.user);
        } catch (error) {
            sessionStorage.removeItem(tokenKey);
        }
    }

    function renderCart() {
        var itemCount = cart.reduce(function (total, item) {
            return total + item.quantity;
        }, 0);
        var total = cart.reduce(function (sum, item) {
            return sum + item.price * item.quantity;
        }, 0);

        cartCount.textContent = itemCount;
        cartTotal.textContent = formatPrice(total);

        if (cart.length === 0) {
            cartItems.innerHTML = '<p class="cart-empty">Giỏ hàng đang trống.</p>';
            return;
        }

        cartItems.innerHTML = cart.map(function (item) {
            return '<div class="cart-item">' +
                '<div><strong>' + escapeHtml(item.name) + '</strong>' +
                '<span>' + formatPrice(item.price) + ' x ' + item.quantity + '</span></div>' +
                '<button type="button" class="cart-item__remove" data-remove-cart-item="' + item.id + '">Xóa</button>' +
                "</div>";
        }).join("");
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            var entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            };
            return entities[character];
        });
    }

    function openCart() {
        cartPanel.classList.add("is-open");
        cartPanel.setAttribute("aria-hidden", "false");
        cartBackdrop.hidden = false;
        document.body.classList.add("cart-is-open");
    }

    function closeCart() {
        cartPanel.classList.remove("is-open");
        cartPanel.setAttribute("aria-hidden", "true");
        cartBackdrop.hidden = true;
        document.body.classList.remove("cart-is-open");
    }

    function showPurchaseAccount(card) {
        var title = card.querySelector("h3").textContent.trim();
        var details = card.querySelector("ul");
        var price = card.querySelector("strong");
        purchaseAccountDetails.innerHTML =
            "<h3>" + escapeHtml(title) + "</h3>" +
            (details ? details.outerHTML : "<p>Thông tin chi tiết account sẽ được shop xác nhận khi mua.</p>") +
            (price ? "<strong class=\"purchase-account__price\">" + escapeHtml(price.textContent) + "</strong>" : "");
        purchaseAccount.hidden = false;
        purchaseAccount.classList.add("is-open");
        purchaseAccount.setAttribute("aria-hidden", "false");
        document.body.classList.add("cart-is-open");
    }

    function closePurchaseAccount() {
        purchaseAccount.hidden = true;
        purchaseAccount.classList.remove("is-open");
        purchaseAccount.setAttribute("aria-hidden", "true");
        document.body.classList.remove("cart-is-open");
    }

    function goToLogin(message) {
        var loginMessage = document.getElementById("login-message");
        showAuthMessage(loginMessage, message, true);
        window.location.hash = "login";
        document.getElementById("login").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    async function handleBuyClick(button) {
        var card = button.closest(".product-card");
        var token = sessionStorage.getItem(tokenKey);
        if (!token) {
            goToLogin("Vui lòng đăng nhập trước khi mua account.");
            return;
        }

        try {
            await apiRequest("/auth/me");
            showPurchaseAccount(card);
        } catch (error) {
            sessionStorage.removeItem(tokenKey);
            renderAccount(null);
            goToLogin("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        }
    }

    function addToCart(button) {
        var card = button.closest(".product-card");
        var nameElement = card && card.querySelector("h3");
        var priceElement = card && card.querySelector("strong");

        if (!card || !nameElement) {
            return;
        }

        var item = {
            id: nameElement.textContent.trim().toLowerCase(),
            name: nameElement.textContent.trim(),
            price: parsePrice(priceElement ? priceElement.textContent : "0"),
            quantity: 1
        };
        var existingItem = cart.find(function (cartItem) {
            return cartItem.id === item.id;
        });

        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push(item);
        }

        saveCart();
        renderCart();
        openCart();
    }

    document.getElementById("cart-toggle").addEventListener("click", openCart);
    document.getElementById("cart-close").addEventListener("click", closeCart);
    cartBackdrop.addEventListener("click", closeCart);

    document.addEventListener("click", function (event) {
        var removeButton = event.target.closest("[data-remove-cart-item]");
        if (removeButton) {
            cart = cart.filter(function (item) {
                return item.id !== removeButton.dataset.removeCartItem;
            });
            saveCart();
            renderCart();
            return;
        }

        var buyButton = event.target.closest(".btn-buy");
        if (buyButton) {
            event.preventDefault();
            handleBuyClick(buyButton);
        }
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeCart();
            closePurchaseAccount();
        }
    });

    document.getElementById("purchase-account-close").addEventListener("click", closePurchaseAccount);
    document.getElementById("purchase-contact").addEventListener("click", closePurchaseAccount);
    document.getElementById("cart-checkout").addEventListener("click", function () {
        closeCart();
        window.location.hash = "contact";
    });

    document.getElementById("product-search").addEventListener("input", function (event) {
        var query = event.target.value.trim().toLowerCase();
        var cards = document.querySelectorAll("#products .product-card");
        var visibleCards = 0;

        cards.forEach(function (card) {
            var name = card.querySelector("h3").textContent.toLowerCase();
            var isVisible = name.includes(query);
            card.hidden = !isVisible;
            if (isVisible) {
                visibleCards += 1;
            }
        });

        var emptyMessage = document.getElementById("product-search-empty");
        if (!emptyMessage) {
            emptyMessage = document.createElement("p");
            emptyMessage.id = "product-search-empty";
            emptyMessage.className = "search-empty";
            document.querySelector("#products .product-grid").after(emptyMessage);
        }
        emptyMessage.textContent = visibleCards === 0 ? "Không tìm thấy sản phẩm phù hợp." : "";
        emptyMessage.hidden = visibleCards !== 0;
    });

    document.getElementById("login-form").addEventListener("submit", async function (event) {
        event.preventDefault();
        var identifier = document.getElementById("login-username").value.trim();
        var password = document.getElementById("login-password").value;
        var message = document.getElementById("login-message");

        try {
            var result = await apiRequest("/auth/login", {
                method: "POST",
                body: JSON.stringify({ identifier: identifier, password: password })
            });
            sessionStorage.setItem(tokenKey, result.token);
            renderAccount(result.user);
            showAuthMessage(message, "Đăng nhập thành công.", false);
            this.reset();
        } catch (error) {
            showAuthMessage(message, getApiError(error), true);
        }
    });

    document.getElementById("register-form").addEventListener("submit", async function (event) {
        event.preventDefault();
        var password = document.getElementById("register-password").value;
        var confirmPassword = document.getElementById("register-confirm-password").value;
        var message = document.getElementById("register-message");

        if (password !== confirmPassword) {
            showAuthMessage(message, "Mật khẩu nhập lại không khớp.", true);
            return;
        }

        try {
            var result = await apiRequest("/auth/register", {
                method: "POST",
                body: JSON.stringify({
                    username: document.getElementById("register-username").value.trim(),
                    email: document.getElementById("register-email").value.trim(),
                    phone: document.getElementById("register-phone").value.trim(),
                    password: password
                })
            });
            sessionStorage.setItem(tokenKey, result.token);
            renderAccount(result.user);
            showAuthMessage(message, "Đăng ký thành công.", false);
            this.reset();
        } catch (error) {
            showAuthMessage(message, getApiError(error), true);
        }
    });

    document.getElementById("logout-button").addEventListener("click", async function () {
        try {
            await apiRequest("/auth/logout", { method: "POST" });
        } catch (error) {
            console.error("Không thể thông báo đăng xuất cho máy chủ.", error);
        } finally {
            sessionStorage.removeItem(tokenKey);
            renderAccount(null);
            window.location.hash = "login";
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener("click", function (event) {
            var target = document.querySelector(link.getAttribute("href"));
            if (!target || target.classList.contains("acc-list")) {
                return;
            }

            event.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            history.replaceState(null, "", link.getAttribute("href"));
        });
    });

    renderCart();
    loadAccount();
}());
