(function () {
    "use strict";

    var cartKey = "tsqh-shop-cart";
    var usersKey = "tsqh-shop-users";
    var currentUserKey = "tsqh-shop-current-user";
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

    function loadUsers() {
        try {
            var users = JSON.parse(localStorage.getItem(usersKey));
            return Array.isArray(users) ? users : [];
        } catch (error) {
            console.warn("Không thể đọc dữ liệu tài khoản.", error);
            return [];
        }
    }

    function saveUsers(users) {
        localStorage.setItem(usersKey, JSON.stringify(users));
    }

    async function hashPassword(password) {
        var data = new TextEncoder().encode(password);
        var hash = await crypto.subtle.digest("SHA-256", data);
        return Array.from(new Uint8Array(hash)).map(function (byte) {
            return byte.toString(16).padStart(2, "0");
        }).join("");
    }

    function showAuthMessage(element, message, isError) {
        element.textContent = message;
        element.className = "form-message " + (isError ? "is-error" : "is-success");
    }

    function getCurrentUser() {
        var username = localStorage.getItem(currentUserKey);
        return loadUsers().find(function (user) {
            return user.username === username;
        }) || null;
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
        renderAccount(getCurrentUser());
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
        if (!getCurrentUser()) {
            goToLogin("Vui lòng đăng nhập trước khi mua account.");
            return;
        }

        showPurchaseAccount(card);
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
        var users = loadUsers();
        var user = users.find(function (candidate) {
            return candidate.username === identifier.toLowerCase() || candidate.email === identifier.toLowerCase();
        });

        if (!user || user.passwordHash !== await hashPassword(password)) {
            showAuthMessage(message, "Tên đăng nhập/email hoặc mật khẩu không đúng.", true);
            return;
        }

        localStorage.setItem(currentUserKey, user.username);
        renderAccount(user);
        showAuthMessage(message, "Đăng nhập thành công.", false);
        this.reset();
    });

    document.getElementById("register-form").addEventListener("submit", async function (event) {
        event.preventDefault();
        var username = document.getElementById("register-username").value.trim().toLowerCase();
        var email = document.getElementById("register-email").value.trim().toLowerCase();
        var phone = document.getElementById("register-phone").value.trim();
        var password = document.getElementById("register-password").value;
        var confirmPassword = document.getElementById("register-confirm-password").value;
        var message = document.getElementById("register-message");
        var users = loadUsers();

        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
            showAuthMessage(message, "Tên đăng nhập phải dài 3-30 ký tự.", true);
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showAuthMessage(message, "Email không hợp lệ.", true);
            return;
        }
        if (!/^[0-9+()\s.-]{8,20}$/.test(phone)) {
            showAuthMessage(message, "Số điện thoại không hợp lệ.", true);
            return;
        }
        if (password.length < 8) {
            showAuthMessage(message, "Mật khẩu phải có ít nhất 8 ký tự.", true);
            return;
        }
        if (password !== confirmPassword) {
            showAuthMessage(message, "Mật khẩu nhập lại không khớp.", true);
            return;
        }
        if (users.some(function (user) {
            return user.username === username || user.email === email;
        })) {
            showAuthMessage(message, "Tên đăng nhập hoặc email đã được sử dụng.", true);
            return;
        }

        var newUser = {
            id: Date.now().toString(),
            username: username,
            email: email,
            phone: phone,
            passwordHash: await hashPassword(password),
            orders: []
        };
        users.push(newUser);
        saveUsers(users);
        localStorage.setItem(currentUserKey, newUser.username);
        renderAccount(newUser);
        showAuthMessage(message, "Đăng ký thành công.", false);
        this.reset();
    });

    document.getElementById("logout-button").addEventListener("click", function () {
        localStorage.removeItem(currentUserKey);
        renderAccount(null);
        window.location.hash = "login";
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
