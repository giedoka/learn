/*jslint browser: true*/
/*global $, jQuery, alert, console,*/

;(function ($) {
  'use strict';

  $.fn.cartOptions = function (options) {
    var s,
      gs = $.extend({}, $.fn.cartOptions.defaults, options),
      cartOptions = {
        settings: {
          cart: $(gs.cartSummary),
          products: $(gs.cartSummary).find(gs.products),
          productForm: $('[name="order"]').parents('form'),
          formSubmitButton: $('[name="order"]'),
          quantityInput: $(gs.products).find(gs.quantityInput),
          deleteItem: $(gs.products).find(gs.deleteItem),
          cartPrice: $(gs.cartPrice),
          cartWidgetPrice: $(gs.cartWidgetPrice),
          cartItemCount: $(gs.cartItemCount),
          decreaseButton: $(gs.decreaseButton),
          increaseButton: $(gs.increaseButton),
          removeAllButton: $(gs.removeAllButton),
          cartList: $(gs.cartList),
          sideMenu: $(gs.sideMenu),
          productAddToCartButton: $('.add-to-cart, .product-list figure figcaption form button[type="submit"]'),
          slidingCartWidgetTrigger: $('.cart-widget-trigger'),
          slidingCartWidgetClose: $('.cart-widget-close'),
          productAddDone: gs.productAddDone,
          localStorageProducts: [],
          validationObject: {}
        },

        init: function () {
            s = this.settings;
			PoGetCart.done(function(){
				if ($('#minicartSummary').length) {
					s.isDynamicCart = true;
				}

				if (s.productForm.find(gs.products).length) {
					$('body').addClass('prevent-submit');
				}


				cartOptions.assignLocalStorageObj();
				 console.log('jest POClearCart i PoCarMap', localStorage.getItem('POClearCart') === '1' && PoCartMap.length);
				if (localStorage.getItem('POClearCart') === '1' && PoCartMap.length) {
					console.log('jest POClearCart i PoCarMap 1');
					cartOptions.clearAdditionalProducts();
					cartOptions.assignLocalStorageObj();
				} else {
					if (s.isDynamicCart && PoCartMap.length) {
						cartOptions.updateCart();
					} else {
						cartOptions.sumAllProducts()
					}
					localStorage.removeItem('POClearCart')
				}

			  cartOptions.bindUIActions();
			  if (gs.showFreeShippingInfo == true) {
				cartOptions.updateFreeShippingInfo($(gs.cartSumPrice).data('sum'))
			  }

			  return cartOptions
			});
        },
        productCartEvents: function () {
          $(gs.increaseButton).on('click', function () {
            var input = $(this).siblings(gs.quantityInput);
            if (!input.prop('disabled')) {
              var val = parseInt(input.val());
              input.val(val + 1);
              input.change()
            }
          });
          $(gs.decreaseButton).on('click', function () {
            var input = $(this).siblings(gs.quantityInput);
            if (!input.prop('disabled')) {
              var val = parseInt(input.val());
              input.val(val - 1);
              input.change()
            }
          });
          $(gs.quantityInput).keypress(function (event) {
            if (event.which != 8 && isNaN(String.fromCharCode(event.which))) {
              event.preventDefault()
            }
          });
          
          $(gs.quantityInput).keyup(function (event) {
            var keyCode = event.which;
            if (keyCode > 57) {
              keyCode -= 48
            }
            if (event.which != 8 && isNaN(String.fromCharCode(keyCode))) {
              event.preventDefault()
            } else {
              cartOptions.onInputChange($(this), false)
            }
          });
          $(gs.quantityInput).on('change', function () {
            if (!$.isNumeric($(this).val()) || $(this).val() <= 0) {
              $(this).val(1)
            }
            cartOptions.onInputChange($(this), true)
          });
          $(gs.quantityInput).on('focusin', function(){
            $(this).data('oldval', $(this).val())
          });
          $(gs.decreaseButton, gs.increaseButton).on('focusin', function(){
            $(this).data('val', $(this).val())
          });
          $(gs.deleteItem).on('click', function (e) {
            e.preventDefault();
            var product = $(this).parents(gs.products),
                line = product.index();
            cartOptions.ajaxUpdateCart(line, 0, product);
          })
        },
        bindUIActions: function () {
          cartOptions.productCartEvents();

            s.productForm.on('submit', function (e) {
                if ($('body').hasClass('prevent-submit')) {
                    e.preventDefault();
                    $('body').removeClass('prevent-submit');
                    cartOptions.prepareToSubmit();
                }
            });

          $(gs.removeAllButton).on('click', function (e) {
            e.preventDefault();
            cartOptions.ajaxClearCart()
          });
          // dynamic things
          if (gs.isDynamic) {
            s.slidingCartWidgetTrigger.on('click', function (e) {
              e.preventDefault();
              cartOptions.toggleSlidingCartWidget('toggle')
            });
            s.slidingCartWidgetClose.on('click', function () {
              cartOptions.toggleSlidingCartWidget('toggle')
            });
            $(document).keyup(function (e) {
              if (e.keyCode == 27) { // escape key maps to keycode `27`
                cartOptions.toggleSlidingCartWidget('close')
              }
            });
            $(document).mouseup(function (e) {
              var container = $('.sliding-cart-widget');

              if (!container.is(e.target) // if the target of the click isn't the container...
                && container.has(e.target).length === 0) // ... nor a descendant of the container
              {
                cartOptions.toggleSlidingCartWidget('close')
              }
            });

            s.productAddToCartButton.on('click', function (e) {
              e.preventDefault();
              var thisElement = $(this);
              cartOptions.productAddToCart(thisElement)
            });

            $('body').on('change focus', '[name^="properties["], [data-property-name]', function(){
                var elem = $(this),
                    elemPoGroup = elem.parents('.po-form-group'),
                    dataInvalid = elemPoGroup.attr('data-valid');
                if (dataInvalid&& dataInvalid === 'invalid') {
                    elemPoGroup.removeAttr('data-valid');
                } 
            });

          }
        },
        productAddToCart: function ($this) {
         var thisForm = $this.parents('form'),
            productId = thisForm.find('input[name="id[]"]').val(),
            productQty = thisForm.find('input[name="quantity"]').val() || 1,
            propertiesElements = thisForm.find('[name^="properties["], [data-property-name]'),
            elementsLength = propertiesElements.length,
            formData = new FormData(),
            appendedFiles,
            i = 0;

            var validate = cartOptions.productOptionsValidation(thisForm);

            console.log('validate', validate);
            if (validate === true) {
                formData.append('id[]', productId);
                formData.append('quantity', productQty);

                for (i; i < elementsLength; i++) {
                    var element = propertiesElements.eq(i),
                        type = element[0].type,
                        name = element[0].name,
                        value = element[0].value;

                        if (value && value != '') {
                        switch (type) {
                            case 'file':
                            formData.append(name, element[0].files[0], element[0].files[0].name);
                            break;

                            case 'select-one':
                            case 'textarea':
                            case 'text':
                            case 'number':
                            formData.append(name, value);
                            break;

                            case 'checkbox':
                            case 'radio':
                            if (element.is(':checked')) {
                                formData.append(name, value)
                            }
                        }
                    }
                }

                var complete = function complete(data) {
                    var response = JSON.parse(data.responseText);
                    if (response.result === true) {
                        cartOptions.assignLocalStorageObj();
                    if (gs.isDynamic) {
                        cartOptions.showShopMessage($(gs.cartWidgetSummary), data.message, 'success');
                        cartOptions.updateCart()
                    } else {
                        MAIN.showShopMessage(response.message, 'success')
                    }
                    
                    $('body').toggleClass('show-cart-widget').addClass('prevent-submit');
                    } else {
                    if (gs.isDynamic) {
                        cartOptions.showShopMessage($(gs.cartWidgetSummary), response.message, 'error')
                    } else {
                        MAIN.showShopMessage(response.message, 'error')
                    }
                    }
                };

                if (productQty == undefined) {
                    productQty = 1
                }


                var productLsKey = Shop.productOptions.updateLocalStorage();

                if (!PoCartMap.length) {
                    PoCartMap.push(new cartProduct(productId, productQty, productId));
                }
                console.log(s.validationObject);
                var assign = cartOptions.assignLocalStorageObj();
                assign.done(function(){
                    console.log(s.validationObject);
                    console.log('finish assignLocalStorageObj');
                    var checkProductAvailbility = cartOptions.checkProductAvailbility(productLsKey, productQty);

                    if (checkProductAvailbility === true) {
                        SHOPLOAJAX.addProductToCartFormData(formData, complete)
                    } else {
                        PoCartMap = [];
                        localStorage.removeItem(productLsKey);
                    }
                });

               
            } else {
                return false;
            }
        },
        updateCart: function ($this) {

          var cartList = $('.mini-products-list'),
            items = cartList.find('.mini-products-item:not(.item-template)'),
            itemTemplate = cartList.find('.item-template'),
            cartListEmpty = $('.mini-products-list-empty'),
            cartHasVariants = false,
            totalCountHandler = $('#totalCount'),
            totalPriceHandler = $('.mini-products-list-total-price .price');
          
          SHOPLOAJAX.getCart().done(function (data) {
            PoCartMap = [];
            
            if (data.item_count != 0) {
              cartList.parents('form').removeClass('hidden');
              cartListEmpty.addClass('hidden');
              items.remove();
              $.each(data.items, function (i, val) {
                PoCartMap.push(new cartProduct(val.id, val.variant_id, val.quantity));
                var newItem = itemTemplate.clone(),
                  price = parseFloat(val.price / 100).toFixed(2);
                newItem.attr('data-variant-id', val.variant_id);
                newItem.find(gs.priceText).text(Shop.money_format.replace('{{amount}}', price));
                newItem.find('.product-image img').attr('src', val.image.replace('th1024', 'th160'));
                newItem.find('.product-image a').attr('href', val.url);
                newItem.find('.mini-products-item-quantity input').val(val.quantity);
                newItem.find('.mini-products-item-quantity input').attr('data-current-id', val.variant_id);
                newItem.find('.mini-products-item-quantity input').data('price', price);
                $.each(val.variant_properties, function (i, val) {
                  var variant = '<li>' + val.name + ': ' + val.value + '</li>';
                  newItem.find('.mini-products-item-properties').append(variant)
                });
                $.each(val.properties, function (i, val) {
                    if (val.value.indexOf('/storeuploads') !== -1) {
                        var variant = '<li>' + val.title + ': ' +   '<a href="' + val.value + '" target="_blank">' + uploadedFileTrans + '</a></li>'
                    } else {
                        var variant = '<li>' + val.title + ': ' + val.value + '</li>'
                    }
                  
                  newItem.find('.mini-products-item-properties').append(variant)
                });
                newItem.find('.mini-product-title').text(val.product_title);
                if (val.vendor != '') {
                  newItem.find('.product-vendor').text(val.vendor)
                }
                newItem.hide();
                newItem.removeClass('item-template').appendTo(cartList).fadeIn();
                if (val.variant_properties.length > 0) {
                  cartHasVariants = true
                }
              });
              cartOptions.productCartEvents();
              cartOptions.updateCartProductsVariantsView(cartHasVariants)
            } else {
              cartList.parents('form').addClass('hidden');
              cartListEmpty.removeClass('hidden')
            }
            // cartOptions.assignLocalStorageObj();
            cartOptions.sumAllProducts()
          })
        },
        toggleSlidingCartWidget: function (action) {
          if (action == 'toggle') {
            $('body').toggleClass('show-cart-widget')
          } else if (action == 'close') {
            $('body').removeClass('show-cart-widget')
          }
          return false
        },
        onInputChange: function (input, change) {
          if (input.data('last') != input.val()) {
            var product = input.parents(gs.products),
                variantID = product.data('variant-id'),
                productData = {},
                line = product.index();

            input.data('last', input.val());
            input.data('focus', !change);

            if (input.val() > 0) {
                productData.id = product.data('variant-id');
                productData.quantity = input.val();
                var checkProductAvailbility = cartOptions.checkProductAvailbility(product.data('key'), input.val(), input.data('oldval'));
                if (checkProductAvailbility === true) {
                    cartOptions.ajaxUpdateCart(line, input.val(), product)
                } else {
                    input.val(input.data('oldval'));
                }
            }
          }
        },
        sumAllProducts: function () {

            cartOptions.assignLSKeyToProduct();

            var overall = 0;
            var count = 0,
                j, itemKey,
                storageChildProducts = [];

            s.cart.css('display', 'block');
            $.each($('body').find(gs.products), function () {
                var amount = parseFloat($.trim($(this).find(gs.quantityInput).val() | 0), 10),
                price = parseFloat($.trim($(this).find(gs.quantityInput).data('price')), 10),
                childsPrice = parseFloat($(this).attr('data-childs-price'), 10) || 0;
                console.log($(this));
                console.log(amount, price, childsPrice);
                var productOverall = amount * price + childsPrice;

                overall += productOverall;
                count += amount;

                if ($(this).find(gs.productPriceSumWrapper).length) {
                $(this).find(gs.productPriceSumWrapper).text(Shop.money_format.replace('{{amount}}', productOverall.toFixed(2)))
                } else {
                $(this).find('.product-price span').text(Shop.money_format.replace('{{amount}}', productOverall.toFixed(2)))
                }
            });

            var priceWithoutDelivery = parseFloat(overall).toFixed(2);
            if ($('#sumPriceWithoutShipping').length) {
                $('#sumPriceWithoutShipping').find('b').text(Shop.money_format.replace('{{amount}}', priceWithoutDelivery))
            }
            if (gs.showDefaultDeliveryCost == true) {
                var newPrice = parseFloat(overall) + parseFloat(gs.cartDefaultDeliveryCost);
                newPrice = newPrice.toFixed(2)
            } else {
                var newPrice = parseFloat(overall).toFixed(2)
            }

            if (parseFloat(s.cartPrice.text()) != newPrice) {
                $(gs.cartPrice).text(Shop.money_format.replace('{{amount}}', newPrice));
                $(gs.cartWidgetPrice).text(Shop.money_format.replace('{{amount}}', newPrice));
                $(gs.cartSumPrice).data(newPrice);
                $(gs.cartItemCount).text(count).show();
            }
            if (gs.showFreeShippingInfo == true && $(gs.products).length != 0) {
                cartOptions.updateFreeShippingInfo(newPrice)
            }

            if (gs.isDynamic) {
                if ($(gs.cartWidgetSummary).find(gs.products).length == 0) {
                $('#minicartSummary').addClass('hidden');
                $('.mini-products-list-empty').removeClass('hidden');
                $('.cart-free-shipping-info').remove()
                }
            } else {
                if ($(gs.cartSummary).find(gs.products).length == 0) {
                $('#cartSummary').addClass('hidden');
                $('.empty-cart').removeClass('hidden');
                $('.cart-free-shipping-info').remove()
                }
            }
        },
        onRemoveProduct: function (product) {
          product.fadeOut(500, function () {
            product.remove();
            if (gs.isDynamic) {
              var productList = $(gs.cartWidgetSummary).find(gs.products)
            } else {
              var productList = $(gs.cartSummary).find(gs.products)
            }
            s.products = $(gs.cartSummary).find(gs.products);
            var cartHasVariants = false;

            $.each(productList, function () {
              var productHasVariants = $(this).find('.product-variants li').length;
              if (productHasVariants) {
                cartHasVariants = true;
                return false
              }
            });

            cartOptions.updateCartProductsVariantsView(cartHasVariants);
            cartOptions.updateLocalStorage(product, 0);
            cartOptions.sumAllProducts()
          })
        },

        ajaxUpdateCart: function (itemLine, qty, product) {
          var input = product.find(gs.quantityInput);

          input.prop('disabled', true);

          SHOPLOAJAX.changeCart(itemLine, qty)
            .done(function (data) {
              if (data.status === 'ok') {
                  cartOptions.updateLocalStorage(product, qty);
                if (qty == 0) {
                  if (gs.isDynamic) {
                    cartOptions.showShopMessage($(gs.cartWidgetSummary), data.message, 'success')
                  } else {
                    MAIN.showShopMessage(data.message, 'success')
                  }
                  cartOptions.onRemoveProduct(product)
                } else if (input.val() > data.max_quantity) {                        
                    if (gs.isDynamic) {
                        cartOptions.showShopMessage($(gs.cartWidgetSummary), data.message, 'error')
                    } else {
                        MAIN.showShopMessage(data.message, 'error')
                    }

                    input.val(data.max_quantity);
                    input.data('last', data.max_quantity)
                } else {
                    if (typeof(data.message) == 'undefined') {
                        

                        cartOptions.sumAllProducts();
                    }
                    
                }
              } 

              input.prop('disabled', false);
              if (input.data('focus')) {
                input.focus()
              }
            })
        },
        ajaxClearCart: function () {
          SHOPLOAJAX.clearCart()
            .done(function (data) {
              s.products.each(function () {
                cartOptions.onRemoveProduct($(this))
              });

              if (gs.isDynamic) {
                $('#minicartSummary').addClass('hidden');
                $('.mini-products-list-empty').removeClass('hidden')
              } else {
                $('#cartSummary').addClass('hidden');
                $('.empty-cart').removeClass('hidden')
              }
            })
        },
        updateFreeShippingInfo: function (total_price) {
          var infoBlock = $('<p />', {'class': gs.freeShippingInfoClass}),
            priceFreeShippingLabel = cart_free_delivery_info,
            priceToFreeShipping = parseFloat(cart_free_delivery_price),
            cartTotalPrice = parseFloat(total_price),
            freeShippingMessage = $('.cart-free-shipping-info');

          if (cartTotalPrice < priceToFreeShipping) {
            var priceToGetFree = priceToFreeShipping - cartTotalPrice,
              message = cart_free_delivery_info.replace('{price}', '<b>' + Shop.money_format.replace('{{amount}}', priceToGetFree.toFixed(2)) + '</b>');
            infoBlock.append(message);
            if (freeShippingMessage.length) {
              freeShippingMessage.replaceWith(infoBlock)
            } else {
              infoBlock.hide();
              if ($('body').attr('id') == 'page-cart') {
                $('#page-cart header.cart-title .row').append(infoBlock.fadeIn())
              } else {
                $(gs.cartWidgetSummary).before(infoBlock.fadeIn())
              }
            }
          } else {
            if (freeShippingMessage.length) {
              freeShippingMessage.fadeOut(function () {
                freeShippingMessage.remove()
              })
            }
          }
        },

        showShopMessage: function (parent, text, type) {
          if ($.trim(parent.find('.cart-msg').text()) == '' && text && type) {
            parent.prepend('<p class="cart-msg ' + type + '">' + text + '</p>')
          }
          setTimeout(function () {
            parent.find('.cart-msg').fadeOut(function () {
              $(this).remove()
            })
          }, 3500)
        },

        updateCartProductsVariantsView: function (hasVariants) {
          var cartHeadVariants = $('.cart-head-variants'),
            cartHeadProduct = $('.cart-head-product, .product-data'),
            cartProductVariants = $('.product-variants');

          if (hasVariants == true) {
            cartHeadVariants.show();
            cartHeadProduct.removeClass('col-md-7').addClass('col-md-5');
            cartProductVariants.show()
          } else {
            cartHeadVariants.hide();
            cartHeadProduct.removeClass('col-md-5').addClass('col-md-7');
            cartProductVariants.hide()
          }
        },

        prepareToSubmit: function () {
            var itemKey,
                productsToAdd = {},
                productsIds = [],
                productsQty = {};

            for (var key in s.localStorageProducts) {
                if (s.localStorageProducts[key]) {
                    var item = s.localStorageProducts[key],
                        childsLength = item.children.length,
                        c, i;
                    if (childsLength) {
                        for (i = 0; i < childsLength; i++) {
                            var childId = item.children[i][0],
                                childQty = parseInt(item.children[i][1]);
                            if (!productsToAdd[childId]) {
                                productsToAdd[childId] = 0;
                            }
                            productsToAdd[childId] += childQty;
                        }
                    }

                }
            }

            for (var id in productsToAdd) {
                if (productsToAdd.hasOwnProperty(id)) {
                    productsIds.push(id);
                    productsQty[id] = productsToAdd[id]
                }
            }
            localStorage.setItem('POClearCart', '1');
            SHOPLOAJAX.addProductToCart(productsIds, productsQty);

            setTimeout(function () {
                s.formSubmitButton.click();
            }, 0);
        },

        updateLocalStorage: function (product, newQty) {
            var newLocalStorageArray = {},
                productKey = product.data('key');
                if (newQty != 0) {
                    var localStorageProductKey = cartOptions.findKeyByValue(s.localStorageProducts, productKey, 'key'),
                        children = s.localStorageProducts[localStorageProductKey].children,
                        productId = s.localStorageProducts[localStorageProductKey].productId,
                        childsLength = children.length,
                        newChildren = [],
                        i;

                        newLocalStorageArray.productId = productId;
                        newLocalStorageArray.quantity = newQty;

                        s.localStorageProducts[localStorageProductKey].quantity = newQty;

                        if (childsLength) {
                            for (i = 0; i < childsLength; i++) {
                                children[i][1] = newQty;
                                newChildren.push([children[i][0], newQty, children[i][2]])
                            }
                        }

                        newLocalStorageArray.children = newChildren;

                        localStorage.setItem(productKey, JSON.stringify(newLocalStorageArray));
                } else {
                    localStorage.removeItem(productKey);
                }
                cartOptions.assignLocalStorageObj();
        },

        findKeyByValue: function (obj, val, keyValue) {
            var returnKey;
            $.each(obj, function (key, value) {
                if (value[keyValue] == val) {
                    returnKey = key;
                }
            });
            return returnKey;
        },

        clearAdditionalProducts: function () {
            var productsArray = [],
                productsToRemove = {};

                var cartItems = PoCartMap,
                    j, i, cartItemsLength = cartItems.length;

                if (cartItems) {
                    for (i = 0; i < cartItemsLength; i++) {
                        var item = cartItems[i];
                        productsArray.push(parseInt(item.quantity));
                    }
                    for (var key in s.localStorageProducts) {
                        if (s.localStorageProducts[key]) {
                            var item = s.localStorageProducts[key],
                                itemQuantity = parseInt(item.quantity),
                                childsLength = item.children.length,
                                c;
                            if (item.children.length) {
                                for (c = 0; c < item.children.length; c++) {
                                var childId = item.children[c][0],
                                    childQty = parseInt(item.children[c][1]),
                                    key = cartOptions.findKeyByValue(cartItems, childId, 'variant_id');
                                    if (!productsToRemove[key]) {
                                        productsToRemove[key] = 0;
                                    }
                                    productsToRemove[key] += itemQuantity;
                                }
                            }
                        }
                    }

                    var changeCartData = [],
                        eq = [];
     
                    for (var line in productsToRemove) {
                        if (productsToRemove.hasOwnProperty(line) && cartItems[line]) {
                            
                            var newQty = cartItems[line].quantity - productsToRemove[line];
                            if (newQty < 0) {
                                newQty = 0;
                            }
                            productsArray[line] = newQty;
                            if (newQty == 0) {
                                eq.push(parseInt(line))
                            }
                        }
                    }

                    s.productForm.find('.cart-product:not(.item-template)').filter(function(i) {
                        return $.inArray(i, eq) > -1;
                    }).remove();
                    var dataObj = {
                        updates: productsArray
                    };
                    SHOPLOAJAX.updateCart(dataObj).done(function (data) {
                        if (data.status === "ok") {
                            if (s.isDynamicCart) {
                                cartOptions.updateCart();
                            } else {
                                cartOptions.sumAllProducts();
                            }
                            
                        }
                    });
                    localStorage.removeItem('POClearCart');
                    return true;
                }
            return false;
        },

        assignLocalStorageObj: function () {
            console.log('start assignLocalStorageObj');
            console.log('test');
            setTimeout(function() {
               console.log('elo');
            }, 1000);
            var i, j,
                itemKey,
                storageLength = localStorage.length,
                productsArray = [],
                finish = $.Deferred();
                s.localStorageProducts = [];
                s.validationObject = {};
                


                for (var j = localStorage.length - 1; j >= 0; j--) {
                    var itemKey = localStorage.key(j);
                    if (itemKey.indexOf('productPO') !== -1) {
                        if (PoCartMap.length === 0) {
                            localStorage.removeItem(itemKey)
                        } else {
                            var item = JSON.parse(localStorage.getItem(itemKey));
                                item.key = itemKey;
                                s.localStorageProducts.push(item);
                                if (productsArray.indexOf(item.productId) === -1) { 
                                    productsArray.push(item.productId)
                                }
                               
                                if (item.children.length) {
                                    var i, childsLength = item.children.length;
                                    for (i = 0; i < childsLength; i++) {
                                        var childId = item.children[i][0],
                                            childQty = parseInt(item.children[i][1]);
                                            if (productsArray.indexOf(childId) === -1) { 
                                                productsArray.push(childId);
                                            }
                                    }
                                }

                        }
                    }
                }
                
                var productsMap = {
                    ids: productsArray
                };
                if (productsArray.length) {
                    SHOPLOAJAX.getVariants(productsMap).done(function(data){
                        if (data) {
                            s.validationObject = {};
                            var i, itemsLength = data.length, storageProductLength = s.localStorageProducts.length;
                            for (i = 0; i < s.localStorageProducts.length; i++) {
                                var item = s.localStorageProducts[i],
                                    itemId = parseInt(item.productId),
                                    ajaxItemIndex = cartOptions.findKeyByValue(data, itemId, 'id'),
                                    ajaxItem = data[ajaxItemIndex];

                                    cartOptions.createValidationObject(data, item, itemId, ajaxItemIndex, ajaxItem)
                                
                            }
                            
                        }
                        finish.resolve();
                    });
                } else {
                    finish.resolve();
                }
                
                return $.when(finish).done(function(){
                    console.log('finish assignLocalStorageObj');
                }).promise();
        },

        createValidationObject: function(data, item, itemId, ajaxItemIndex, ajaxItem){
            if (typeof(s.validationObject[itemId]) === 'undefined') {
                s.validationObject[itemId] = cartOptions.variantInfo(ajaxItem.available, parseInt(item.quantity), parseInt(ajaxItem.quantity));
            } else {
                s.validationObject[itemId].quantity += parseInt(item.quantity);
            }

            if (item.children.length) {
                var e, childsLength = item.children.length;
                for (e = 0; e < childsLength; e++) {
                    var childId = parseInt(item.children[e][0]),
                        childQty = parseInt(item.children[e][1]),
                        ajaxChildIndex = cartOptions.findKeyByValue(data, childId, 'id'),
                        ajaxChild = data[ajaxChildIndex];

                    if (typeof(s.validationObject[childId]) === 'undefined') {
                            var max_quantity = parseInt(ajaxChild.quantity) - childQty;
                            if (max_quantity < 0) {
                                max_quantity = 0;
                            }
                            s.validationObject[childId] = cartOptions.variantInfo(ajaxChild.available, childQty, max_quantity);
                    } else {
                        var max_quantity = s.validationObject[childId].max_quantity -= childQty;
                        if (max_quantity < 0) {
                            max_quantity = 0;
                        }
                        s.validationObject[childId].max_quantity = max_quantity;
                        s.validationObject[childId].quantity += childQty;
                    }
                }
            }
            
        },

        assignLSKeyToProduct: function () {
            var productsMap = [],
                products = s.productForm.find(gs.products);

            for (var key in s.localStorageProducts) {
                if (s.localStorageProducts[key]) {
                    var storageId = s.localStorageProducts[key].key,
                        storageItem = s.localStorageProducts[key],
                        childsSumPrice = 0,
                        itemQuantity = storageItem.quantity,
                        product = $('.cart-product:not(.item-template)').eq(key);

                    product.attr('data-key', storageId);

                    if (storageItem.children.length) {
                        for (var ch = 0; ch < storageItem.children.length; ch++) {
                            var child = storageItem.children[ch],
                            childQty = parseInt(child[1]),
                            childPrice = child[2],
                            childSum = itemQuantity * childPrice;

                            childsSumPrice += childSum
                        }
                    }
                    product.attr('data-childs-price', childsSumPrice)
                }
            }
        },

        checkProductAvailbility: function(productLsKey, newQty, oldQty) {
            console.log('start checkProductAvailbility');
            var productsToCheck = [],
                localStorageProductKey = cartOptions.findKeyByValue(s.localStorageProducts, productLsKey, 'key'),
                localStorageProduct = s.localStorageProducts[localStorageProductKey],
                childs = localStorageProduct.children,
                childsLength = childs.length,
                quantityToAdd,
                valid = false;

                if (oldQty) {
                    if (oldQty < newQty) {
                        quantityToAdd = oldQty - newQty;
                    } else {
                        quantityToAdd = newQty - oldQty;
                    }
                    
                } else {
                    quantityToAdd = newQty;
                }
                productsToCheck.push(localStorageProduct.productId);

                for (var i = 0; i < childsLength; i++) {
                    productsToCheck.push(childs[i][0])
                }
                console.log('productsToCheck', productsToCheck);

                for (i = 0; i < productsToCheck.length; i++) {
                    var productId = parseInt(productsToCheck[i]);
					console.log(productId, s.validationObject[productId]);
                       var quantity = s.validationObject[productId].quantity,
                        max_quantity = s.validationObject[productId].max_quantity,
                        available = s.validationObject[productId].available,
                        newQtyProduct = newQty + s.validationObject[productId].quantity;
					if (available === true && max_quantity === 0) {
						valid = true
					}
                    else if (quantityToAdd > max_quantity || available === false && oldQty < newQty) {
                        valid = false;
                        break;
                    } else if (quantityToAdd <= max_quantity || max_quantity == 0 && available === true) {
                        valid = true;
                    }
                }

                console.log(valid);

                if (valid === true) {
                    return true;
                } else {
                    if (gs.isDynamic && $('body').hasClass('show-cart-widget')) {
                        cartOptions.showShopMessage($(gs.cartWidgetSummary), productSetIsNotAvailableMsg, 'error')
                    } else {
                        MAIN.showShopMessage(productSetIsNotAvailableMsg, 'error')
                    }
                    return false;
                }
        },

        variantInfo: function(available, quantity, max_quantity) {
            var variantInfo = {
                available: available,
                quantity: quantity,
                max_quantity: max_quantity
            };
            return variantInfo;
        },

        productOptionsValidation: function(form){
            console.log('productOptionsValidation');
            var propertiesElements = form.find('[name^="properties["], [data-property-name]'),
                propertiesElementsLength = propertiesElements.length,
            i;

            for (i = 0; i < propertiesElementsLength; i++) {
                var elem = propertiesElements.eq(i),
                    isVisible = elem.is(':visible'),
                    isRequired = elem.is(':required'),
					name = elem.attr('name'),
                    type = elem[0].type,
                    value = elem[0].value,
                    poFormGroup = elem.parents('.po-form-group'); 
                    if (isVisible && isRequired) {
                        console.log(type, name, [(type === 'radio' || type === 'checkbox') && !elem.is(':checked')] && !form.find('input[name="'+ name +'"]').is(':checked'));
                        if ((type === 'radio' || type === 'checkbox') && !elem.is(':checked') && !form.find('input[name="'+ name +'"]').is(':checked')) {
                        
                                poFormGroup.attr('data-valid', 'invalid');
    
                        } else if (value === '') {
                              console.log('invalid value');
                            poFormGroup.attr('data-valid', 'invalid');
                        } else {
                            console.log('valid');
                            poFormGroup.removeAttr('data-valid');
                        }
                    }
            }
            return (form.find('.po-form-group[data-valid="invalid"]').length) ? false : true;
              
        }
    };
    cartOptions.updateCartOutside = function () {
      cartOptions.updateCart();
      $('body').toggleClass('show-cart-widget')
    };

    return cartOptions.init()
  };
  $.fn.cartOptions.defaults = {
    removeAllButton: '#removeAllProduct',
    products: '.cart-product',
    cartSummary: 'form#cartSummary',
    cartWidgetSummary: '#minicartSummary',
    deleteItem: '.delete-item-button',
    quantityInput: '.product-qty:visible input.qty, .mini-products-item-quantity input',
    productPriceSumWrapper: '.product-price-sum span',
    priceText: '.product-price span',
    increaseButton: '.increase-button',
    decreaseButton: '.decrease-button',
    cartSumPrice: '#sumPrice',
    cartPrice: '#sumPrice span',
    cartWidgetPrice: '.mini-products-list-total-price',
    cartItemCount: '.cart-widget-total-count',
    cartList: '.mini-products-list',
    slidingCartWidget: '.sliding-cart-widget',
    showFreeShippingInfo: true,
    freeShippingContainer: '.cart-free-shipping-info',
    freeShippingInfoClass: 'cart-free-shipping-info col-xs-12',
    showDefaultDeliveryCost: true,
    cartDefaultDeliveryCost: cart_delivery_cost || 0,
    isDynamic: false,
    dynamicCartType: 'right',
    productAddDone: null
  }
}(jQuery))
;var $alicja="bajka";