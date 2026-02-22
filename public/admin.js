

// Dynamic Base Path Detection
const BASE_PATH = window.location.pathname.includes('/resturant-website') ? '/resturant-website' : '';
const API_URL = `${BASE_PATH}/api`;

// Language & Translation System
let currentLanguage = sessionStorage.getItem('adminLanguage') || 'en';

const translations = {
    en: {
        adminPanel: 'Admin Panel',
        logout: 'Logout',
        pendingOrders: 'Pending Orders',
        allOrders: 'All Orders',
        manageProducts: 'Manage Products',
        restaurantSettings: 'Restaurant Settings',
        deliverySettings: 'Delivery Settings',
        deliveryOpeningTime: 'Delivery Opening Time',
        deliveryOpeningTimeHelp: 'Earliest time delivery orders can be scheduled.',
        deliveryClosingTime: 'Delivery Closing Time',
        deliveryClosingTimeHelp: 'Latest time delivery orders can be scheduled.',
        searchProduct: 'Search product...',
        addProduct: 'Add Product',
        selected: 'selected',
        bulkPromo: 'Bulk Promo',
        bulkDelete: 'Bulk Delete',
        createBundle: 'Create Bundle',
        productName: 'Product Name',
        price: 'Price',
        category: 'Category',
        promo: 'Promo',
        actions: 'Actions',
        edit: 'Edit',
        delete: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        confirm: 'Confirm',
        yes: 'Yes',
        no: 'No',
        workingHours: 'Working Hours',
        openingTime: 'Opening Time',
        closingTime: 'Closing Time',
        saveWorkingHours: 'Save Working Hours',
        deliveryCities: 'Delivery Cities & Prices',
        cityName: 'City Name',
        deliveryCitiesHelp: 'Manage available cities for delivery and set delivery price for each city.',
        cityNamePlaceholder: 'e.g., Plovdiv',
        deliveryPrice: 'Delivery Price',
        deliveryPriceEur: 'Delivery Price (EUR)',
        deliveryPricePlaceholder: 'e.g., 5.00',
        addCity: 'Add City',
        enableDelivery: 'Enable Delivery (Show all delivery options)',
        enableDeliveryHelp: 'When disabled, delivery orders will not be available.',
        standardDeliveryFee: 'Standard Delivery Fee',
        standardDeliveryFeeEur: 'Standard Delivery Fee (€)',
        deliveryFeePlaceholder: 'e.g., 5.00',
        deliveryFeeHelp: 'Fee charged for delivery orders',
        freeDeliveryAbove: 'Free Delivery Above',
        enableFreeDeliveryAbove: 'Enable Free Delivery Above Amount',
        minimumOrderAmountEurSymbol: 'Minimum Order Amount (€)',
        minOrderAmountPlaceholder: 'e.g., 50.00',
        freeDeliveryHelp: 'Orders above this amount get free delivery',
        saveDeliverySettings: 'Save Delivery Settings',
        slideshowBanner: 'Promotional Slideshow Banner',
        enableSlideshow: 'Enable Promotional Slideshow (shown only in "All Items" category)',
        autoPlayInterval: 'Auto-play Interval (seconds)',
        slides: 'Slides',
        addSlide: 'Add Slide',
        saveSlideshowSettings: 'Save Slideshow Settings',
        recommendedSizes: 'Recommended banner sizes:',
        desktop: 'Desktop',
        mobile: 'Mobile',
        useHighQuality: 'Use high quality images (JPG/PNG) for best results',

        siteContent: 'Site Content',
        searchMode: 'Search mode',
        namesAndDescriptions: 'Names + Descriptions',
        namesOnly: 'Names only',
        searchModeHelp: 'Controls which fields are searchable in the storefront.',
        webmail: 'Webmail',
        webmailUrl: 'Webmail URL',
        webmailUrlPlaceholder: 'https://mail.example.com/roundcube',
        webmailUrlHelp: 'Optional. If set, admins can open Roundcube webmail in a new tab.',
        openWebmail: 'Open Webmail',
        footer: 'Footer',
        footerAboutText: 'About text',
        footerAddressPlaceholder: 'Street, city',
        footerAddressMapsUrl: 'Address (Google Maps link)',
        footerAddressMapsUrlPlaceholder: 'https://www.google.com/maps?...',
        footerAddressMapsUrlHelp: 'Optional. If empty, we generate a Google Maps search link from the address.',
        footerAboutPlaceholder: 'Short about text...',
        socialLinks: 'Social links',
        siteSocialLabel1: 'Label 1',
        siteSocialUrl1: 'URL 1',
        siteSocialIcon1: 'Icon 1 (FA class)',
        siteSocialLabel2: 'Label 2',
        siteSocialUrl2: 'URL 2',
        siteSocialIcon2: 'Icon 2 (FA class)',
        siteSocialLabel3: 'Label 3',
        siteSocialUrl3: 'URL 3',
        siteSocialIcon3: 'Icon 3 (FA class)',
        map: 'Map',
        showMapAboveFooter: 'Show map above footer',
        requiresLatLng: 'Requires latitude and longitude.',
        pinLabel: 'Pin label (address name)',
        pinLabelPlaceholder: 'Restaurant address / name',
        pinLabelHelp: 'Shown next to the pin. If empty, the Footer address is used.',
        latitude: 'Latitude',
        longitude: 'Longitude',
        zoom: 'Zoom',
        legalPages: 'Legal Pages',
        privacyPolicyHtml: 'Privacy Policy (HTML)',
        termsAndConditionsHtml: 'Terms & Conditions (HTML)',
        privacyPlaceholder: '<h1>Privacy Policy</h1>...',
        termsPlaceholder: '<h1>Terms</h1>...',
        privacyHelp: 'This HTML is rendered on the public privacy page.',
        termsHelp: 'This HTML is rendered on the public terms page.',
        saveSiteContent: 'Save Site Content',

        visualCustomization: 'Visual Customization',
        topBarColor: 'Top Bar Color',
        highlightAccentColor: 'Highlight/Accent Color',
        backgroundColorLabel: 'Background Color',
        priceColorLabel: 'Price Color',
        backgroundImageUrl: 'Background Image URL',
        backgroundImagePlaceholder: 'https://example.com/background.jpg',
        backgroundImageHint: 'Leave empty to use background color instead',
        saveCustomization: 'Save Customization',

        orderSettings: 'Order Settings',
        minimumOrderAmountEur: 'Minimum Order Amount (EUR)',
        minOrderHint: 'Set to 0 to disable minimum order requirement',
        allowOrderLater: 'Allow "Later" scheduling in checkout',
        allowOrderLaterHelp: 'When disabled, customers can only order "Now".',
        restaurantTemporarilyClosed: 'Temporarily close restaurant',
        restaurantTemporarilyClosedHelp: 'Shows a warning banner and blocks checkout ordering.',
        enablePickup: 'Enable Pickup',
        enablePickupHelp: 'When disabled, customers cannot place pickup orders.',
        saveOrderSettings: 'Save Order Settings',

        openingTimeHelp: 'Restaurant opening time for pickup orders',
        closingTimeHelp: 'Restaurant closing time for pickup orders',

        slideshowNoSlides: 'No slides added yet. Click "Add Slide" to get started.',
        slideshowMaxSlides: 'Maximum 10 slides allowed!',
        slideshowFailedAdd: 'Failed to add slide',
        slideshowConfirmRemove: 'Are you sure you want to remove this slide?',
        slideshowFailedRemove: 'Failed to remove slide',
        slideshowFailedMove: 'Failed to move slide',
        slideshowFailedUpload: 'Failed to upload image',
        slideshowFailedUpdateTitle: 'Failed to update title',
        slideshowSavedSuccess: 'Slideshow settings saved successfully!',
        slideshowFailedSave: 'Failed to save slideshow settings',
        slideshowImageLabel: 'Image',
        slideshowCurrentLabel: 'Current:',
        slideshowTitleOptionalPlaceholder: 'Title (optional)',

        siteMapInvalidLatLng: 'Map is enabled but Latitude/Longitude are invalid.',
        siteSettingsSaveFailed: 'Failed to save site settings',
        siteSettingsSaved: 'Site content saved successfully!',
        siteSettingsSaveError: 'Error saving site settings',
        orderSettingsUpdated: 'Order settings updated successfully!',
        orderSettingsFailedUpdate: 'Failed to update order settings',
        orderSettingsErrorUpdate: 'Error updating order settings',
        workingHoursUpdated: 'Working hours updated successfully!',
        workingHoursFailedUpdate: 'Failed to update working hours',
        workingHoursErrorUpdate: 'Error updating working hours',
        customizationUpdated: 'Customization updated successfully!',
        customizationFailedUpdate: 'Failed to update customization',
        customizationErrorUpdate: 'Error updating customization',

        restaurantTab: 'Restaurant',
        deliveryTab: 'Delivery',
        productsTab: 'Products',
        promoCodesTab: 'Promos',
        combosTab: 'Combos',
        approvedOrders: 'Order History',
        menu: 'Menu',
        backToMenu: 'Back to Menu',

        search: 'Search',
        status: 'Status',
        method: 'Method',
        from: 'From',
        to: 'To',
        refresh: 'Refresh',
        print: 'Print',
        exportPdf: 'Export PDF',
        exportCsv: 'Export CSV',
        printApprovedOnly: 'Printing is available only for approved orders.',
        all: 'All',
        delivery: 'Delivery',
        pickup: 'Pickup',

        ordersHistorySearchPlaceholder: 'Order ID / name / phone / email',
        statusPending: 'Pending (received)',
        statusApproved: 'Approved',
        statusDelivering: 'Delivering',
        statusReady: 'Ready for pickup',
        statusCompleted: 'Completed',
        statusCancelled: 'Cancelled',

        showingOrders: 'Showing {count} order(s)',
        noOrdersMatch: 'No orders match the filters.',

        customer: 'Customer',
        phone: 'Phone',
        email: 'Email',
        city: 'City',
        address: 'Address',
        notes: 'Notes',
        products: 'Products',
        total: 'Total',

        csvOrderId: 'Order ID',
        csvCreatedAt: 'Created At',
        csvStatus: 'Status',
        csvMethod: 'Method',
        csvCustomerName: 'Customer Name',
        csvCustomerPhone: 'Customer Phone',
        csvCustomerEmail: 'Customer Email',
        csvCity: 'City',
        csvAddress: 'Address',
        csvCustomerNotes: 'Customer Notes',
        csvItems: 'Items',
        csvItemsNotes: 'Item Notes',
        csvSubtotal: 'Subtotal',
        csvDeliveryFee: 'Delivery Fee',
        csvDiscount: 'Discount',
        csvTotal: 'Total',
        csvOwnerDiscount: 'Owner Discount',
        csvFinalTotal: 'Final Total',

        previous: 'Previous',
        next: 'Next',
        pageInfoEmpty: 'Page 0 of 0',
        pageInfoProducts: 'Page {current} of {total} ({count} products)',

        noProductsFound: 'No products found',
        addFirstProductHint: 'Add your first product using the form above',

        createBundle: 'Create Bundle',
        applyPromoToSelected: 'Apply Promo to Selected',
        deleteSelected: 'Delete Selected',
        applyPromoToCategory: 'Apply Promo to Category',

        manageProductsHeading: 'Manage Products',
        dataManagement: 'Data Management',
        productsCsvImportExport: 'Products CSV Import/Export',
        productsCsvHelp: 'Download a CSV template, fill it with product data, and upload it back to bulk import products.',
        downloadCsvTemplate: 'Download Template',
        exportProductsToCsv: 'Export Products to CSV',
        importProductsFromCsv: 'Import Products from CSV',
        fullDatabaseBackup: 'Full Database Backup',
        exportAllDataJson: 'Export All Data (JSON)',
        importAllDataJson: 'Import All Data (JSON)',
        resetAllData: 'Reset All Data',

        promoCodesManagement: 'Promo Codes Management',
        promoFlyers: 'Promo Flyers',
        promoFlyersHelp: "Generate a ZIP of flyer images for all active promo codes that haven't been printed yet.",
        baseImage: 'Base image',
        baseImageHelp: 'Upload the background image used for every flyer.',
        limitOptional: 'Limit (optional)',
        limitHelp: 'Leave empty to generate for all eligible codes.',
        flyerGenerateCount: 'Generate flyers (new codes)',
        flyerGenerateCountHelp: 'If set, creates that many new promo codes and generates flyers for them.',
        fontSize: 'Font size',
        fontSizeHelp: 'Used for the promo code text overlay.',
        flyerText: 'Flyer text',
        flyerTextHelp: 'Text shown before the code.',
        flyerCodePrefix: 'Promo code prefix',
        flyerCodePrefixHelp: 'Used when generating new promo codes (letters/numbers only).',
        downloadFlyersZip: 'Download Flyers ZIP',
        eligibleCodes: 'eligible',
        printedCodes: 'printed',
        flyerSelectBaseImage: 'Please select a base image first.',
        flyerNoEligibleCodes: 'No eligible promo codes (active + not printed).',
        flyerGenerating: 'Generating flyers…',
        flyerGeneratedZip: 'Flyers ZIP generated.',
        flyerMarkPrintedFailed: 'Flyers downloaded, but failed to mark as printed. Please refresh and try again.',
        flyerBulkNeedsDiscount: 'Please set a discount (1-100%) in the Promo Codes form above before generating new flyers.',
        promoCode: 'Promo Code',
        promoCodePlaceholder: 'e.g., SUMMER25',
        promoUppercaseHelp: 'Code will be converted to uppercase automatically',
        applyToCategory: 'Apply to Category',
        promoCategoryHelp: 'Promo code will apply only to items in this category',
        discountPercentage: 'Discount Percentage',
        discountPercentPlaceholder: 'e.g., 25',
        discountPercentHelp: 'Percentage discount (1-100%)',
        active: 'Active',
        inactive: 'Inactive',
        addPromoCode: 'Add Promo Code',
        activePromoCodes: 'Active Promo Codes',
        promoTableCode: 'Code',
        promoTableCategory: 'Category',
        promoTableDiscount: 'Discount',
        promoTableStatus: 'Status',
        noPromoCodesYet: 'No promo codes yet. Create one above!',

        comboBundleOffers: 'Combo & Bundle Offers',
        comboBundleHelp: 'Create special combo and bundle deals. These will automatically appear in the "Combos & Bundles" category.',
        comboNameEn: 'Combo Name (English):',
        comboNameEnPlaceholder: 'e.g., Family Meal Deal',
        comboNameBg: 'Combo Name (Bulgarian):',
        comboNameBgPlaceholder: 'например, Семейно Комбо',
        comboDescEnPlaceholder: "Describe what's included in this combo...",
        comboDescBgPlaceholder: 'Опишете какво включва комбото...',
        priceEur: 'Price (€)',
        priceEurPlaceholder: 'e.g., 49.99',
        comboTypeCombo: 'Combo (Multiple items together)',
        comboTypeBundle: 'Bundle (Buy X Get Y)',
        imageUrl: 'Image URL',
        comboImagePlaceholder: 'https://example.com/combo-image.jpg',
        selectProductsIncluded: 'Select Products Included:',
        loadingProducts: 'Loading products...',
        createComboBundle: 'Create Combo/Bundle',
        clearForm: 'Clear Form',
        activeCombosBundles: 'Active Combos & Bundles',
        noCombosYet: 'No combos or bundles yet. Create one above!',
        type: 'Type',

        productNameEnglish: 'Product Name (English):',
        productNameBulgarian: 'Product Name (Bulgarian):',
        productNameEnPlaceholder: 'e.g., Margherita Pizza',
        productNameBgPlaceholder: 'например, Пица Маргарита',
        optionalUseEnglishName: 'Optional: Leave empty to use English name',
        productDescEnPlaceholder: 'Describe your product...',
        productDescBgPlaceholder: 'Опишете продукта...',
        optionalUseEnglishDescription: 'Optional: Leave empty to use English description',
        categoryEnglish: 'Category (English):',
        categoryBulgarian: 'Category (Bulgarian):',
        categoryEnPlaceholder: 'e.g., Pizza, Salads',
        categoryBgPlaceholder: 'например, Пица, Салати',
        categoryTip: 'Tip: Use existing categories or create new ones',
        optionalUseEnglishCategory: 'Optional: Leave empty to use English category',
        weightQuantity: 'Weight/Quantity',
        weightPlaceholder: 'e.g., 500g, 300ml, 1 pc',
        weightExample: 'Example: 500g, 300ml, 12 pcs, 1L',
        promotionalPricing: 'Promotional Pricing',
        enablePromotionalPrice: 'Enable Promotional Price',
        promoPriceEur: 'Promo Price (€)',
        promoDuration: 'Promo Duration',
        promoUntilManual: 'Until Manually Disabled',
        promoSetDates: 'Set Start & End Date',
        startDate: 'Start Date',
        endDate: 'End Date',
        productImagePlaceholder: 'https://example.com/image.jpg',
        orUploadImage: 'Or upload an image:',
        imageUploaded: 'Image uploaded successfully!',

        select: 'Select',
        enName: 'EN Name',
        bgName: 'BG Name',
        image: 'Image',

        sessionExpired: 'Session expired. Please login again.',
        selectAtLeastOneProduct: 'Select at least one product.',
        selectAtLeastTwoProductsBundle: 'Please select at least 2 products to create a bundle.',
        cityAndAddressRequired: 'City and address are required for delivery orders.',
        noCitiesYet: 'No cities added yet. Add your first city above.',
        enterCityName: 'Please enter a city name',
        cityAlreadyExists: 'City "{name}" already exists',
        enterValidPrice: 'Please enter a valid price',
        invalidPrice: 'Invalid price',
        enterNewCityName: 'Enter new city name:',
        enterNewDeliveryPrice: 'Enter new delivery price (EUR):',
        confirmDeleteCity: 'Are you sure you want to delete this city?',
        confirmDeleteCityNamed: 'Are you sure you want to delete "{name}"?',
        citiesSavedSuccess: 'Cities saved successfully!',
        citiesFailedSave: 'Failed to save cities',
        citiesErrorSave: 'Error saving cities',
        deliverySettingsSaved: 'Delivery settings saved successfully!',
        deliverySettingsFailedSave: 'Failed to save delivery settings',
        deliverySettingsErrorSave: 'Error saving delivery settings',

        promoEnterCode: 'Please enter a promo code',
        promoEnterDiscountRange: 'Please enter a discount between 1 and 100%',
        promoUpdatedSuccess: 'Promo code updated successfully!',
        promoAddedSuccess: 'Promo code added successfully!',
        promoFailedSave: 'Failed to save promo code',
        promoErrorSave: 'Error saving promo code',
        updatePromoCode: 'Update Promo Code',
        promoDeleteConfirm: 'Are you sure you want to delete this promo code?',
        promoDeletedSuccess: 'Promo code deleted successfully!',
        promoFailedDelete: 'Failed to delete promo code',
        promoErrorDelete: 'Error deleting promo code',
        off: 'OFF',

        comboInvalidNamePrice: 'Please fill in combo name and valid price!',
        comboSelectAtLeastOne: 'Please select at least one product for this combo!',
        comboCreatedSuccess: 'Combo/Bundle created successfully!',
        comboCreateFailed: 'Failed to create combo/bundle',
        comboCreateError: 'Error creating combo/bundle',
        noCombosTable: 'No combos or bundles yet. Create one above!',
        comboLabel: 'Combo',
        bundleLabel: 'Bundle',
        selectedProductsHeading: 'Selected Products:',
        originalTotal: 'Original total:',
        provideBundleNamePrice: 'Please provide a bundle name and valid price!',
        deleteSelectedConfirm: 'Delete {count} selected product(s)? This cannot be undone.',
        deletedProductsSuccess: '{count} product(s) deleted successfully',
        failedToDeleteProducts: 'Failed to delete products: {error}',

        promoAppliedSelected: 'Promo applied to selected products',

        confirmDeleteTitle: 'Confirm Delete',
        confirmDeleteProductText: 'Are you sure you want to delete this product?',
        createBundleFromSelected: 'Create Bundle from Selected Products',
        bundleNameEn: 'Bundle Name (English):',
        bundleNameBg: 'Bundle Name (Bulgarian):',
        bundlePrice: 'Bundle Price (€):',
        bundleSpecialLabel: 'Special Label (Optional):',
        bundleImageUrl: 'Image URL (Optional):',
        leaveEmptyAutoGenerate: 'Leave empty to auto-generate from product names',
        willAppearAsBadge: 'Will appear as a badge on the product card (like promo labels)',
        leaveEmptyUseFirstImage: "Leave empty to use first product's image",
        editOrder: 'Edit Order',
        addNewProduct: 'Add New Product',
        selectCategory: 'Select a category.',
        selectCategoryPlaceholder: 'Select category...',
        allCategories: 'All Categories',
        productsWord: 'products',
        manageProductsSearchPlaceholder: 'Search by EN name, BG name, or ID...',
        deliveryFeeLabel: 'Delivery Fee',
        discountPercentLabel: 'Discount (%)',
        name: 'Name',
        items: 'Items',
        addItem: 'Add Item'
    },
    bg: {
        adminPanel: 'Админ Панел',
        logout: 'Изход',
        pendingOrders: 'Чакащи Поръчки',
        allOrders: 'Всички Поръчки',
        manageProducts: 'Управление на Продукти',
        restaurantSettings: 'Настройки на Ресторант',
        deliverySettings: 'Настройки за Доставка',
        deliveryOpeningTime: 'Начален час за доставка',
        deliveryOpeningTimeHelp: 'Най-ранният час за доставка (за планиране).',
        deliveryClosingTime: 'Краен час за доставка',
        deliveryClosingTimeHelp: 'Най-късният час за доставка (за планиране).',
        searchProduct: 'Търси продукт...',
        addProduct: 'Добави Продукт',
        selected: 'избрани',
        bulkPromo: 'Групово Промо',
        bulkDelete: 'Групово Изтриване',
        createBundle: 'Създай Комбо',
        productName: 'Име на Продукт',
        price: 'Цена',
        category: 'Категория',
        promo: 'Промо',
        actions: 'Действия',
        edit: 'Редактирай',
        delete: 'Изтрий',
        save: 'Запази',
        cancel: 'Отказ',
        confirm: 'Потвърди',
        yes: 'Да',
        no: 'Не',
        workingHours: 'Работно Време',
        openingTime: 'Отваряне',
        closingTime: 'Затваряне',
        saveWorkingHours: 'Запази Работно Време',
        deliveryCities: 'Градове и Цени за Доставка',
        cityName: 'Име на Град',
        deliveryCitiesHelp: 'Управлявайте наличните градове за доставка и задайте цена за всеки град.',
        cityNamePlaceholder: 'напр. Пловдив',
        deliveryPrice: 'Цена за Доставка',
        deliveryPriceEur: 'Цена за Доставка (EUR)',
        deliveryPricePlaceholder: 'напр. 5.00',
        addCity: 'Добави Град',
        enableDelivery: 'Активирай доставка (Показвай всички опции за доставка)',
        enableDeliveryHelp: 'Когато е изключено, доставката няма да е налична.',
        standardDeliveryFee: 'Стандартна Такса за Доставка',
        standardDeliveryFeeEur: 'Стандартна Такса за Доставка (€)',
        deliveryFeePlaceholder: 'напр. 5.00',
        deliveryFeeHelp: 'Такса, начислявана за поръчки с доставка',
        freeDeliveryAbove: 'Безплатна Доставка над',
        enableFreeDeliveryAbove: 'Активирай безплатна доставка над сума',
        minimumOrderAmountEurSymbol: 'Минимална Сума (€)',
        minOrderAmountPlaceholder: 'напр. 50.00',
        freeDeliveryHelp: 'Поръчки над тази сума са с безплатна доставка',
        saveDeliverySettings: 'Запази Настройки за Доставка',
        slideshowBanner: 'Промоционално Слайдшоу Банер',
        enableSlideshow: 'Активирай Промоционално Слайдшоу (показва се само в категория "Всички")',
        autoPlayInterval: 'Интервал на Auto-play (секунди)',
        slides: 'Слайдове',
        addSlide: 'Добави Слайд',
        saveSlideshowSettings: 'Запази Настройки на Слайдшоу',
        recommendedSizes: 'Препоръчителни размери на банери:',
        desktop: 'Десктоп',
        mobile: 'Мобилна',
        useHighQuality: 'Използвайте високо качество изображения (JPG/PNG) за най-добър резултат',

        siteContent: 'Съдържание на Сайта',
        searchMode: 'Режим на търсене',
        namesAndDescriptions: 'Имена + Описания',
        namesOnly: 'Само имена',
        searchModeHelp: 'Определя кои полета са търсими в магазина.',
        webmail: 'Уеб поща',
        webmailUrl: 'Линк към уеб поща',
        webmailUrlPlaceholder: 'https://mail.example.com/roundcube',
        webmailUrlHelp: 'По избор. Ако е зададено, админите могат да отварят Roundcube в нов таб.',
        openWebmail: 'Отвори уеб поща',
        footer: 'Футър',
        footerAboutText: 'Текст „За нас“',
        footerAddressPlaceholder: 'Улица, град',
        footerAddressMapsUrl: 'Адрес (Google Maps линк)',
        footerAddressMapsUrlPlaceholder: 'https://www.google.com/maps?...',
        footerAddressMapsUrlHelp: 'По избор. Ако е празно, ще генерираме Google Maps линк от адреса.',
        footerAboutPlaceholder: 'Кратък текст „За нас“...',
        socialLinks: 'Социални връзки',
        siteSocialLabel1: 'Етикет 1',
        siteSocialUrl1: 'URL 1',
        siteSocialIcon1: 'Икона 1 (FA клас)',
        siteSocialLabel2: 'Етикет 2',
        siteSocialUrl2: 'URL 2',
        siteSocialIcon2: 'Икона 2 (FA клас)',
        siteSocialLabel3: 'Етикет 3',
        siteSocialUrl3: 'URL 3',
        siteSocialIcon3: 'Икона 3 (FA клас)',
        map: 'Карта',
        showMapAboveFooter: 'Покажи карта над футъра',
        requiresLatLng: 'Изисква ширина и дължина.',
        pinLabel: 'Етикет на пина (име/адрес)',
        pinLabelPlaceholder: 'Адрес / име на ресторанта',
        pinLabelHelp: 'Показва се до пина. Ако е празно, се използва адресът от футъра.',
        latitude: 'Ширина',
        longitude: 'Дължина',
        zoom: 'Мащаб',
        legalPages: 'Правни Страници',
        privacyPolicyHtml: 'Политика за Поверителност (HTML)',
        termsAndConditionsHtml: 'Общи Условия (HTML)',
        privacyPlaceholder: '<h1>Политика за поверителност</h1>...',
        termsPlaceholder: '<h1>Условия</h1>...',
        privacyHelp: 'Този HTML се показва на публичната страница „Поверителност“.',
        termsHelp: 'Този HTML се показва на публичната страница „Условия“.',
        saveSiteContent: 'Запази Съдържанието',

        visualCustomization: 'Визуална Персонализация',
        topBarColor: 'Цвят на горната лента',
        highlightAccentColor: 'Акцентен цвят',
        backgroundColorLabel: 'Фонов цвят',
        priceColorLabel: 'Цвят на цените',
        backgroundImageUrl: 'URL на фонова снимка',
        backgroundImagePlaceholder: 'https://example.com/background.jpg',
        backgroundImageHint: 'Оставете празно, за да се използва фоновият цвят',
        saveCustomization: 'Запази Персонализацията',

        orderSettings: 'Настройки на Поръчки',
        minimumOrderAmountEur: 'Минимална сума на поръчка (EUR)',
        minOrderHint: 'Задайте 0, за да изключите минималната сума',
        allowOrderLater: 'Разреши опцията "По-късно" в поръчката',
        allowOrderLaterHelp: 'Когато е изключено, клиентите могат да поръчват само "Сега".',
        restaurantTemporarilyClosed: 'Временно затвори ресторанта',
        restaurantTemporarilyClosedHelp: 'Показва предупреждение и блокира поръчките.',
        enablePickup: 'Разреши взимане от място',
        enablePickupHelp: 'Когато е изключено, клиентите не могат да правят поръчки за взимане.',
        saveOrderSettings: 'Запази Настройките на Поръчки',

        openingTimeHelp: 'Час на отваряне за поръчки с вземане',
        closingTimeHelp: 'Час на затваряне за поръчки с вземане',

        slideshowNoSlides: 'Няма добавени слайдове. Натиснете "Добави Слайд", за да започнете.',
        slideshowMaxSlides: 'Максимум 10 слайда!',
        slideshowFailedAdd: 'Неуспешно добавяне на слайд',
        slideshowConfirmRemove: 'Сигурни ли сте, че искате да премахнете този слайд?',
        slideshowFailedRemove: 'Неуспешно премахване на слайд',
        slideshowFailedMove: 'Неуспешно преместване на слайд',
        slideshowFailedUpload: 'Неуспешно качване на изображение',
        slideshowFailedUpdateTitle: 'Неуспешно обновяване на заглавие',
        slideshowSavedSuccess: 'Настройките на слайдшоуто са запазени!',
        slideshowFailedSave: 'Неуспешно запазване на настройките на слайдшоу',
        slideshowImageLabel: 'Изображение',
        slideshowCurrentLabel: 'Текущо:',
        slideshowTitleOptionalPlaceholder: 'Заглавие (по избор)',

        siteMapInvalidLatLng: 'Картата е активирана, но ширината/дължината са невалидни.',
        siteSettingsSaveFailed: 'Неуспешно запазване на настройките на сайта',
        siteSettingsSaved: 'Съдържанието на сайта е запазено!',
        siteSettingsSaveError: 'Грешка при запазване на настройките на сайта',
        orderSettingsUpdated: 'Настройките на поръчките са обновени!',
        orderSettingsFailedUpdate: 'Неуспешно обновяване на настройките на поръчките',
        orderSettingsErrorUpdate: 'Грешка при обновяване на настройките на поръчките',
        workingHoursUpdated: 'Работното време е обновено!',
        workingHoursFailedUpdate: 'Неуспешно обновяване на работното време',
        workingHoursErrorUpdate: 'Грешка при обновяване на работното време',
        customizationUpdated: 'Персонализацията е обновена!',
        customizationFailedUpdate: 'Неуспешно обновяване на персонализацията',
        customizationErrorUpdate: 'Грешка при обновяване на персонализацията',

        restaurantTab: 'Ресторант',
        deliveryTab: 'Доставка',
        productsTab: 'Продукти',
        promoCodesTab: 'Промоции',
        combosTab: 'Комбо',
        approvedOrders: 'История на поръчките',
        menu: 'Меню',
        backToMenu: 'Към Менюто',

        search: 'Търси',
        status: 'Статус',
        method: 'Метод',
        from: 'От',
        to: 'До',
        refresh: 'Опресни',
        print: 'Принт',
        exportPdf: 'Експорт PDF',
        exportCsv: 'Експорт CSV',
        printApprovedOnly: 'Принтирането е достъпно само за одобрени поръчки.',
        all: 'Всички',
        delivery: 'Доставка',
        pickup: 'Вземане',

        ordersHistorySearchPlaceholder: 'ID / име / телефон / имейл',
        statusPending: 'Чакаща (получена)',
        statusApproved: 'Одобрена',
        statusDelivering: 'В доставка',
        statusReady: 'Готова за вземане',
        statusCompleted: 'Завършена',
        statusCancelled: 'Отказана',

        showingOrders: 'Показва {count} поръчки',
        noOrdersMatch: 'Няма поръчки по тези филтри.',

        customer: 'Клиент',
        phone: 'Телефон',
        email: 'Имейл',
        city: 'Град',
        address: 'Адрес',
        notes: 'Бележки',
        products: 'Продукти',
        total: 'Общо',

        csvOrderId: 'ID',
        csvCreatedAt: 'Дата',
        csvStatus: 'Статус',
        csvMethod: 'Метод',
        csvCustomerName: 'Клиент',
        csvCustomerPhone: 'Телефон',
        csvCustomerEmail: 'Имейл',
        csvCity: 'Град',
        csvAddress: 'Адрес',
        csvCustomerNotes: 'Бележки (клиент)',
        csvItems: 'Артикули',
        csvItemsNotes: 'Бележки (артикули)',
        csvSubtotal: 'Сума',
        csvDeliveryFee: 'Доставка',
        csvDiscount: 'Отстъпка',
        csvTotal: 'Общо',
        csvOwnerDiscount: 'Отстъпка (собственик)',
        csvFinalTotal: 'Крайна сума',

        previous: 'Предишна',
        next: 'Следваща',
        pageInfoEmpty: 'Страница 0 от 0',
        pageInfoProducts: 'Страница {current} от {total} ({count} продукта)',

        noProductsFound: 'Няма намерени продукти',
        addFirstProductHint: 'Добавете първия продукт от формата по-горе',

        createBundle: 'Създай Комбо',
        applyPromoToSelected: 'Промо за избраните',
        deleteSelected: 'Изтрий избраните',
        applyPromoToCategory: 'Промо за категория',

        manageProductsHeading: 'Управление на Продукти',
        dataManagement: 'Управление на Данни',
        productsCsvImportExport: 'CSV импорт/експорт на продукти',
        productsCsvHelp: 'Изтеглете CSV шаблон, попълнете продуктите и го качете обратно за масов импорт.',
        downloadCsvTemplate: 'Изтегли шаблон',
        exportProductsToCsv: 'Експорт на продукти в CSV',
        importProductsFromCsv: 'Импорт на продукти от CSV',
        fullDatabaseBackup: 'Пълен бекъп на базата',
        exportAllDataJson: 'Експорт на всички данни (JSON)',
        importAllDataJson: 'Импорт на всички данни (JSON)',
        resetAllData: 'Нулирай всички данни',

        promoCodesManagement: 'Управление на промо кодове',
        promoFlyers: 'Промо флаери',
        promoFlyersHelp: 'Генерирай ZIP с флаери за всички активни промо кодове, които още не са отпечатани.',
        baseImage: 'Базова снимка',
        baseImageHelp: 'Качете фон снимка, която ще се използва за всеки флаер.',
        limitOptional: 'Лимит (по избор)',
        limitHelp: 'Оставете празно за всички налични кодове.',
        flyerGenerateCount: 'Генерирай флаери (нови кодове)',
        flyerGenerateCountHelp: 'Ако зададете брой, ще създаде толкова нови промо кодове и ще генерира флаери за тях.',
        fontSize: 'Размер на шрифта',
        fontSizeHelp: 'Използва се за текста с промо кода.',
        flyerText: 'Текст на флаера',
        flyerTextHelp: 'Текст преди кода.',
        flyerCodePrefix: 'Префикс на промо кода',
        flyerCodePrefixHelp: 'Използва се при генериране на нови промо кодове (само букви/цифри).',
        downloadFlyersZip: 'Свали ZIP с флаери',
        eligibleCodes: 'за печат',
        printedCodes: 'отпечатани',
        flyerSelectBaseImage: 'Моля изберете базова снимка.',
        flyerNoEligibleCodes: 'Няма налични промо кодове за печат (активни + неотпечатани).',
        flyerGenerating: 'Генериране на флаери…',
        flyerGeneratedZip: 'ZIP файлът с флаери е готов.',
        flyerMarkPrintedFailed: 'ZIP е свален, но не успях да маркирам кодовете като отпечатани. Моля опитайте пак.',
        flyerBulkNeedsDiscount: 'Моля задайте отстъпка (1–100%) в формата за промо кодове по-горе, преди да генерирате нови флаери.',
        promoCode: 'Промо код',
        promoCodePlaceholder: 'напр. SUMMER25',
        promoUppercaseHelp: 'Кодът се конвертира автоматично в главни букви',
        applyToCategory: 'Приложи към категория',
        promoCategoryHelp: 'Промо кодът важи само за продукти от тази категория',
        discountPercentage: 'Процент отстъпка',
        discountPercentPlaceholder: 'напр. 25',
        discountPercentHelp: 'Отстъпка в проценти (1–100%)',
        active: 'Активен',
        inactive: 'Неактивен',
        addPromoCode: 'Добави промо код',
        activePromoCodes: 'Активни промо кодове',
        promoTableCode: 'Код',
        promoTableCategory: 'Категория',
        promoTableDiscount: 'Отстъпка',
        promoTableStatus: 'Статус',
        noPromoCodesYet: 'Все още няма промо кодове. Създайте отгоре!',

        comboBundleOffers: 'Комбо и пакети',
        comboBundleHelp: 'Създайте специални комбо и пакетни оферти. Те ще се появят автоматично в категорията „Комбо и пакети“.',
        comboNameEn: 'Име на комбо (английски):',
        comboNameEnPlaceholder: 'напр. Family Meal Deal',
        comboNameBg: 'Име на комбо (български):',
        comboNameBgPlaceholder: 'напр. Семейно Комбо',
        comboDescEnPlaceholder: 'Опишете какво включва това комбо...',
        comboDescBgPlaceholder: 'Опишете какво включва комбото...',
        priceEur: 'Цена (€)',
        priceEurPlaceholder: 'напр. 49.99',
        comboTypeCombo: 'Комбо (няколко продукта заедно)',
        comboTypeBundle: 'Пакет (купи X, получи Y)',
        imageUrl: 'URL на изображение',
        comboImagePlaceholder: 'https://example.com/combo-image.jpg',
        selectProductsIncluded: 'Изберете включени продукти:',
        loadingProducts: 'Зареждане на продукти...',
        createComboBundle: 'Създай комбо/пакет',
        clearForm: 'Изчисти формата',
        activeCombosBundles: 'Активни комбо и пакети',
        noCombosYet: 'Все още няма комбо или пакети. Създайте отгоре!',
        type: 'Тип',

        productNameEnglish: 'Име на продукт (английски):',
        productNameBulgarian: 'Име на продукт (български):',
        productNameEnPlaceholder: 'напр. Пица Маргарита',
        productNameBgPlaceholder: 'напр. Пица Маргарита',
        optionalUseEnglishName: 'По избор: оставете празно, за да се използва английското име',
        productDescEnPlaceholder: 'Опишете продукта...',
        productDescBgPlaceholder: 'Опишете продукта...',
        optionalUseEnglishDescription: 'По избор: оставете празно, за да се използва английското описание',
        categoryEnglish: 'Категория (английски):',
        categoryBulgarian: 'Категория (български):',
        categoryEnPlaceholder: 'напр. Пица, Салати',
        categoryBgPlaceholder: 'напр. Пица, Салати',
        categoryTip: 'Съвет: използвайте съществуващи категории или създайте нови',
        optionalUseEnglishCategory: 'По избор: оставете празно, за да се използва английската категория',
        weightQuantity: 'Грамаж/Количество',
        weightPlaceholder: 'напр. 500g, 300ml, 1 бр.',
        weightExample: 'Пример: 500g, 300ml, 12 бр., 1L',
        promotionalPricing: 'Промо цена',
        enablePromotionalPrice: 'Активирай промо цена',
        promoPriceEur: 'Промо цена (€)',
        promoDuration: 'Продължителност',
        promoUntilManual: 'Докато не бъде изключено ръчно',
        promoSetDates: 'Задай начало и край',
        startDate: 'Начална дата',
        endDate: 'Крайна дата',
        productImagePlaceholder: 'https://example.com/image.jpg',
        orUploadImage: 'Или качете изображение:',
        imageUploaded: 'Изображението е качено успешно!',

        select: 'Избор',
        enName: 'EN Име',
        bgName: 'BG Име',
        image: 'Снимка',

        sessionExpired: 'Сесията изтече. Моля, влезте отново.',
        selectAtLeastOneProduct: 'Изберете поне един продукт.',
        selectAtLeastTwoProductsBundle: 'Изберете поне 2 продукта за да създадете комбо.',
        cityAndAddressRequired: 'Градът и адресът са задължителни при поръчки с доставка.',
        noCitiesYet: 'Все още няма добавени градове. Добавете първия отгоре.',
        enterCityName: 'Моля, въведете име на град',
        cityAlreadyExists: 'Град "{name}" вече съществува',
        enterValidPrice: 'Моля, въведете валидна цена',
        invalidPrice: 'Невалидна цена',
        enterNewCityName: 'Въведете ново име на град:',
        enterNewDeliveryPrice: 'Въведете нова цена за доставка (EUR):',
        confirmDeleteCity: 'Сигурни ли сте, че искате да изтриете този град?',
        confirmDeleteCityNamed: 'Сигурни ли сте, че искате да изтриете "{name}"?',
        citiesSavedSuccess: 'Градовете са записани успешно!',
        citiesFailedSave: 'Неуспешно записване на градовете',
        citiesErrorSave: 'Грешка при записване на градовете',
        deliverySettingsSaved: 'Настройките за доставка са записани успешно!',
        deliverySettingsFailedSave: 'Неуспешно записване на настройките за доставка',
        deliverySettingsErrorSave: 'Грешка при записване на настройките за доставка',

        promoEnterCode: 'Моля, въведете промо код',
        promoEnterDiscountRange: 'Моля, въведете отстъпка между 1 и 100%',
        promoUpdatedSuccess: 'Промо кодът е обновен успешно!',
        promoAddedSuccess: 'Промо кодът е добавен успешно!',
        promoFailedSave: 'Неуспешно записване на промо кода',
        promoErrorSave: 'Грешка при записване на промо кода',
        updatePromoCode: 'Обнови промо код',
        promoDeleteConfirm: 'Сигурни ли сте, че искате да изтриете този промо код?',
        promoDeletedSuccess: 'Промо кодът е изтрит успешно!',
        promoFailedDelete: 'Неуспешно изтриване на промо кода',
        promoErrorDelete: 'Грешка при изтриване на промо кода',
        off: 'ОТСТЪПКА',

        comboInvalidNamePrice: 'Моля, попълнете име на комбо и валидна цена!',
        comboSelectAtLeastOne: 'Моля, изберете поне един продукт за това комбо!',
        comboCreatedSuccess: 'Комбото/пакетът е създаден успешно!',
        comboCreateFailed: 'Неуспешно създаване на комбо/пакет',
        comboCreateError: 'Грешка при създаване на комбо/пакет',
        noCombosTable: 'Все още няма комбо или пакети. Създайте отгоре!',
        comboLabel: 'Комбо',
        bundleLabel: 'Пакет',
        selectedProductsHeading: 'Избрани продукти:',
        originalTotal: 'Оригинална сума:',
        provideBundleNamePrice: 'Моля, въведете име на пакета и валидна цена!',
        deleteSelectedConfirm: 'Да изтрия {count} избрани продукта? Това не може да се върне.',
        deletedProductsSuccess: 'Изтрити {count} продукта успешно',
        failedToDeleteProducts: 'Грешка при изтриване: {error}',

        promoAppliedSelected: 'Промото е приложено към избраните продукти',

        confirmDeleteTitle: 'Потвърдете изтриването',
        confirmDeleteProductText: 'Сигурни ли сте, че искате да изтриете този продукт?',
        createBundleFromSelected: 'Създай комбо от избраните продукти',
        bundleNameEn: 'Име на комбото (Английски):',
        bundleNameBg: 'Име на комбото (Български):',
        bundlePrice: 'Цена на комбото (€):',
        bundleSpecialLabel: 'Специален етикет (по избор):',
        bundleImageUrl: 'URL на снимка (по избор):',
        leaveEmptyAutoGenerate: 'Оставете празно за авто-генериране от имената на продуктите',
        willAppearAsBadge: 'Ще се показва като бадж на картата на продукта (като промо етикет)',
        leaveEmptyUseFirstImage: 'Оставете празно за да се използва снимката на първия продукт',
        editOrder: 'Редактирай Поръчка',
        addNewProduct: 'Добави Нов Продукт',
        selectCategory: 'Изберете категория.',
        selectCategoryPlaceholder: 'Изберете категория...',
        allCategories: 'Всички Категории',
        productsWord: 'продукта',
        manageProductsSearchPlaceholder: 'Търси по EN име, BG име или ID...',
        deliveryFeeLabel: 'Такса доставка',
        discountPercentLabel: 'Отстъпка (%)',
        name: 'Име',
        items: 'Артикули',
        addItem: 'Добави артикул'
    }
};

function t(key, fallback = '') {
    const table = translations?.[currentLanguage] || translations?.en || {};
    const value = table?.[key];
    if (typeof value === 'string' && value.length) return value;
    return fallback;
}

function switchLanguage(lang) {
    currentLanguage = lang;
    sessionStorage.setItem('adminLanguage', lang);
    
    // Update all translatable elements
    document.querySelectorAll('[data-translate]').forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[lang][key]) {
            element.textContent = translations[lang][key];
        }
    });
    
    // Update title attributes
    document.querySelectorAll('[data-translate-title]').forEach(element => {
        const key = element.getAttribute('data-translate-title');
        if (translations[lang][key]) {
            element.setAttribute('title', translations[lang][key]);
        }
    });
    
    // Update placeholder attributes
    document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
        const key = element.getAttribute('data-translate-placeholder');
        if (translations[lang][key]) {
            element.setAttribute('placeholder', translations[lang][key]);
        }
    });
    
    // Update language button active states
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // Re-render dynamic sections so newly generated strings are localized.
    try { renderProducts(); } catch (e) {}
    try { renderOrdersHistory(); } catch (e) {}
    try { renderComboProductSelector(); } catch (e) {}
    try { renderCities(); } catch (e) {}
    try { renderPromoCodes(); } catch (e) {}
    try { loadCombos(); } catch (e) {}
    try { updateManageSelectionUI(); } catch (e) {}
    try { loadSlideshowSettings(); } catch (e) {}

    try {
        buildAdminDrawerMenu();
        updateAdminDrawerActive(localStorage.getItem('adminCurrentTab') || 'pending-orders');
    } catch (e) {}
}

// Initialize language on page load
document.addEventListener('DOMContentLoaded', () => {
    switchLanguage(currentLanguage);

    // Mobile: start with the menu collapsed (dropdown opens via the header toggle)
    try {
        const nav = document.getElementById('adminNav');
        const icon = document.getElementById('toggleIcon');
        const isMobile = !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
        if (nav && isMobile) {
            nav.classList.add('collapsed');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        }
    } catch (e) {}
});

// Tab Switching Function
function switchTab(tabName) {
    const normalizedTab = (tabName === 'combos') ? 'promo-codes' : tabName;

    // Hide all tab contents
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    

    // Show selected tab content
    const selectedTab = document.getElementById(`tab-${normalizedTab}`);
    if (selectedTab) selectedTab.classList.add('active');

    // Merge: Promo Codes tab also shows Combos content
    if (normalizedTab === 'promo-codes') {
        const combosTab = document.getElementById('tab-combos');
        if (combosTab) combosTab.classList.add('active');
    }

    // Add active class to the matching button (don't rely on window.event)
    const tabBtn = document.querySelector(`[onclick="switchTab('${normalizedTab}')"]`);
    if (tabBtn) tabBtn.classList.add('active');

    try { updateAdminDrawerActive(normalizedTab); } catch (e) {}

    // Save current tab to localStorage
    localStorage.setItem('adminCurrentTab', normalizedTab);

    // Mobile: close the dropdown after selecting a tab
    try {
        const nav = document.getElementById('adminNav');
        const icon = document.getElementById('toggleIcon');
        const isMobile = !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
        if (nav && isMobile) {
            nav.classList.add('collapsed');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        }
    } catch (e) {}
}

function getAdminHeaderHeight() {
    const header = document.querySelector('.admin-header');
    if (!header) return 0;
    const rect = header.getBoundingClientRect();
    return rect.height || 0;
}

function adminScrollToElement(el) {
    if (!el) return;
    const offset = Math.ceil(getAdminHeaderHeight() + 12);
    const rect = el.getBoundingClientRect();
    const target = rect.top + window.pageYOffset - offset;
    window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
}

function openAdminDrawer() {
    const overlay = document.getElementById('adminDrawerOverlay');
    if (!overlay) return;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('admin-drawer-open');
    try { buildAdminDrawerMenu(); } catch (e) {}
}

function closeAdminDrawer() {
    const overlay = document.getElementById('adminDrawerOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('admin-drawer-open');
}

function getAdminBasePath() {
    try {
        return window.location.pathname.includes('/resturant-website') ? '/resturant-website' : '';
    } catch (e) {
        return '';
    }
}

// Toggle Navigation Visibility (repurposed to the drawer)
function toggleNav() {
    const nav = document.getElementById('adminNav');
    if (!nav) return;
    const isMobile = !!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    if (!isMobile) return;
    nav.classList.toggle('collapsed');

    const icon = document.getElementById('toggleIcon');
    if (icon) {
        const isCollapsed = nav.classList.contains('collapsed');
        icon.classList.toggle('fa-bars', isCollapsed);
        icon.classList.toggle('fa-times', !isCollapsed);
    }
}

function updateAdminDrawerActive(normalizedTab) {
    const menu = document.getElementById('adminDrawerMenu');
    if (!menu) return;
    menu.querySelectorAll('.drawer-group').forEach(g => g.classList.remove('active'));
    menu.querySelectorAll('.drawer-item-btn').forEach(b => b.classList.remove('active'));

    const group = menu.querySelector(`.drawer-group[data-tab="${CSS.escape(normalizedTab)}"]`);
    if (group) {
        group.classList.add('active');
        // If nothing is open yet, open the active group.
        if (!group.classList.contains('open')) group.classList.add('open');
    }
}

function extractTabNameFromOnclick(btn) {
    const raw = (btn && btn.getAttribute('onclick')) ? btn.getAttribute('onclick') : '';
    const m = raw.match(/switchTab\('([^']+)'\)/);
    return m ? m[1] : '';
}

function getTabLabelFromBtn(btn) {
    if (!btn) return '';
    const span = btn.querySelector('.tab-text');
    const txt = (span ? span.textContent : btn.textContent) || '';
    return txt.toString().trim();
}

function getTabIconClass(btn) {
    const icon = btn ? btn.querySelector('i') : null;
    const cls = icon ? icon.className : '';
    return (cls || 'fas fa-circle').toString();
}

function getTabSections(tabName) {
    const normalizedTab = (tabName === 'combos') ? 'promo-codes' : tabName;

    const tabsToScan = [normalizedTab];
    if (normalizedTab === 'promo-codes') tabsToScan.push('combos');

    const sections = [];
    tabsToScan.forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (!el) return;
        const list = Array.from(el.querySelectorAll('.admin-section'));
        list.forEach((sec, idx) => {
            let id = (sec.getAttribute('id') || '').toString().trim();
            if (!id) {
                id = `section-${t}-${idx + 1}`;
                sec.setAttribute('id', id);
            }

            const heading = sec.querySelector('h2, h3');
            const title = heading ? heading.textContent.toString().trim().replace(/\s+/g, ' ') : `Section ${idx + 1}`;
            sections.push({ id, title });
        });
    });

    return { normalizedTab, sections };
}

function buildAdminDrawerMenu() {
    const menu = document.getElementById('adminDrawerMenu');
    if (!menu) return;

    const tabBtns = Array.from(document.querySelectorAll('.admin-tabs-nav .admin-tab-btn'));
    if (!tabBtns.length) return;

    const activeTab = (localStorage.getItem('adminCurrentTab') || 'pending-orders').toString();
    menu.innerHTML = '';

    tabBtns.forEach(btn => {
        const tabName = extractTabNameFromOnclick(btn);
        if (!tabName) return;

        const label = getTabLabelFromBtn(btn) || tabName;
        const iconClass = getTabIconClass(btn);
        const { normalizedTab, sections } = getTabSections(tabName);

        const group = document.createElement('div');
        group.className = 'drawer-group';
        group.dataset.tab = normalizedTab;

        const headerBtn = document.createElement('button');
        headerBtn.type = 'button';
        headerBtn.className = 'drawer-group-btn';
        headerBtn.setAttribute('aria-expanded', 'false');

        headerBtn.innerHTML = `
            <div class="drawer-group-left">
                <span class="drawer-group-icon"><i class="${escapeHtml(iconClass)}"></i></span>
                <span class="drawer-group-title">${escapeHtml(label)}</span>
            </div>
            <span class="drawer-chevron"><i class="fas fa-chevron-down"></i></span>
        `;

        const items = document.createElement('div');
        items.className = 'drawer-items';

        // First item: open tab (top)
        const openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'drawer-item-btn';
        openBtn.innerHTML = `<span class="drawer-item-bullet"></span><span>${escapeHtml(label)}</span>`;
        openBtn.addEventListener('click', () => {
            closeAdminDrawer();
            switchTab(normalizedTab);
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
        });
        items.appendChild(openBtn);

        sections.forEach(sec => {
            const secBtn = document.createElement('button');
            secBtn.type = 'button';
            secBtn.className = 'drawer-item-btn';
            secBtn.dataset.sectionId = sec.id;
            secBtn.innerHTML = `<span class="drawer-item-bullet"></span><span>${escapeHtml(sec.title)}</span>`;
            secBtn.addEventListener('click', () => {
                closeAdminDrawer();
                switchTab(normalizedTab);
                setTimeout(() => {
                    const el = document.getElementById(sec.id);
                    if (el) adminScrollToElement(el);
                }, 80);
            });
            items.appendChild(secBtn);
        });

        headerBtn.addEventListener('click', () => {
            const willOpen = !group.classList.contains('open');

            // Accordion behavior: close others.
            menu.querySelectorAll('.drawer-group.open').forEach(other => {
                if (other === group) return;
                other.classList.remove('open');
                const otherBtn = other.querySelector('.drawer-group-btn');
                if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
            });

            group.classList.toggle('open', willOpen);
            headerBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        });

        group.appendChild(headerBtn);
        group.appendChild(items);
        menu.appendChild(group);

        // Auto-open the active tab group
        if (normalizedTab === (activeTab === 'combos' ? 'promo-codes' : activeTab)) {
            group.classList.add('open');
            headerBtn.setAttribute('aria-expanded', 'true');
        }
    });

    updateAdminDrawerActive(activeTab === 'combos' ? 'promo-codes' : activeTab);
}

function initAdminDrawer() {
    const overlay = document.getElementById('adminDrawerOverlay');
    if (!overlay) return;

    const backLink = document.getElementById('adminDrawerBackLink');
    if (backLink) {
        const base = getAdminBasePath();
        backLink.setAttribute('href', `${base}/`);
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeAdminDrawer();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAdminDrawer();
    });

    try { buildAdminDrawerMenu(); } catch (e) {}

    // Auto-open the menu on first entry per session.
    try {
        const didAutoOpen = sessionStorage.getItem('adminDrawerAutoOpened') === '1';
        if (!didAutoOpen) {
            sessionStorage.setItem('adminDrawerAutoOpened', '1');
            setTimeout(() => openAdminDrawer(), 60);
        }
    } catch (e) {}
}

// Restore last active tab on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedRaw = localStorage.getItem('adminCurrentTab') || 'pending-orders';
    const savedTab = savedRaw === 'combos' ? 'promo-codes' : savedRaw;
    switchTab(savedTab);
    try { initAdminDrawer(); } catch (e) {}
});

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
        countEl.textContent = `${count} ${t('selected', 'selected')}`;
    }
    
    // Update top bar count
    if (countElTop) {
        countElTop.textContent = `${count} ${t('selected', 'selected')}`;
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
    // Token is normally in sessionStorage, but we also accept localStorage as a fallback.
    // This reduces "Not authenticated" confusion after refresh/navigation.
    const token = getAdminToken();
    return !!token;
}

function getAdminToken() {
    return sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken');
}

function clearAdminToken() {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
}

async function ensureAuthOrRedirect() {
    const token = getAdminToken();
    if (!token) return false;

    // Prefer sessionStorage for the current tab once we have a token.
    if (!sessionStorage.getItem('adminToken')) {
        try { sessionStorage.setItem('adminToken', token); } catch (e) {}
    }

    try {
        const res = await fetch(`${API_URL}/restaurants/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) return true;
    } catch (e) {
        // fall through
    }

    // Token is missing/expired (server restarts clear in-memory tokens)
    clearAdminToken();
    alert(t('sessionExpired', 'Session expired. Please login again.'));
    window.location.href = `${BASE_PATH}/login`;
    return false;
}

// Logout function
function logout() {
    clearAdminToken();
    window.location.href = `${BASE_PATH}/login`;
}

// Load data on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication first
    if (!checkAuth()) {
        window.location.href = `${BASE_PATH}/login`;
        return;
    }

    (async () => {
        const ok = await ensureAuthOrRedirect();
        if (!ok) return;

        loadProducts();
        loadRestaurantName();
        loadSiteSettings();
        loadCustomization();
        setupForm();
        setupColorInputs();
        loadPromoCodes();
        initPromoFlyersUI();
        initManageControls();
        loadCategories();
        initProductSearchUI();
        loadProductsForSearch();
        loadDeliverySettings();
        loadCities();
        loadProductsForCombo();
        startOrdersPolling();
        loadWorkingHours();
        loadPrinterSettings();
        loadSlideshowSettings();
        maybeEnableEmailDiagnosticsPanel();
        initializeZonesMap();
    })();
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
                alert(t('selectAtLeastTwoProductsBundle', 'Please select at least 2 products to create a bundle.'));
                return;
            }
            openBundleModal();
        });
    }
    
    if (createBundleBtnTop) {
        createBundleBtnTop.addEventListener('click', () => {
            if (manageSelected.size < 2) {
                alert(t('selectAtLeastTwoProductsBundle', 'Please select at least 2 products to create a bundle.'));
                return;
            }
            openBundleModal();
        });
    }

    if (bulkPromoBtn) {
        bulkPromoBtn.addEventListener('click', async () => {
            const ids = Array.from(manageSelected);
            if (ids.length === 0) { alert(t('selectAtLeastOneProduct', 'Select at least one product.')); return; }
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
            if (ids.length === 0) { alert(t('selectAtLeastOneProduct', 'Select at least one product.')); return; }
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
            if (ids.length === 0) { alert(t('selectAtLeastOneProduct', 'Select at least one product.')); return; }
            if (!confirm(t('deleteSelectedConfirm', `Delete ${ids.length} selected product(s)? This cannot be undone.`).replace('{count}', String(ids.length)))) return;
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
                alert(t('deletedProductsSuccess', `${result.count} product(s) deleted successfully`).replace('{count}', String(result.count)));
                await loadProducts();
                manageSelected.clear();
                if (selectAll) selectAll.checked = false;
                updateManageSelectionUI();
            } catch (e) {
                console.error('Delete failed:', e);
                alert(t('failedToDeleteProducts', `Failed to delete products: ${e.message}`).replace('{error}', e.message));
            }
        });
    }
    
    // Bulk delete selected products (top button)
    if (bulkDeleteBtnTop) {
        bulkDeleteBtnTop.addEventListener('click', async () => {
            const ids = Array.from(manageSelected);
            if (ids.length === 0) { alert(t('selectAtLeastOneProduct', 'Select at least one product.')); return; }
            if (!confirm(t('deleteSelectedConfirm', `Delete ${ids.length} selected product(s)? This cannot be undone.`).replace('{count}', String(ids.length)))) return;
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
                alert(t('deletedProductsSuccess', `${result.count} product(s) deleted successfully`).replace('{count}', String(result.count)));
                await loadProducts();
                manageSelected.clear();
                if (selectAll) selectAll.checked = false;
                updateManageSelectionUI();
            } catch (e) {
                console.error('Delete failed:', e);
                alert(t('failedToDeleteProducts', `Failed to delete products: ${e.message}`).replace('{error}', e.message));
            }
        });
    }

    if (categoryPromoBtn) {
        categoryPromoBtn.addEventListener('click', async () => {
            const category = categorySelect.value;
            if (!category) { alert(t('selectCategory', 'Select a category.')); return; }
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
    bulkCategorySelect.innerHTML = `<option value="">${t('selectCategoryPlaceholder', 'Select category...')}</option>` + Array.from(categories).map(c => `<option value="${c}">${c}</option>`).join('');

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
                        <td>${Number(p.price).toFixed(2)} €</td>
                        <td>${p.promo?.enabled ? `<span class="badge" style="background:#e74c3c;color:#fff;">${Number(p.promo.price).toFixed(2)} €</span>` : '-'}
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
        alert(t('promoAppliedSelected', 'Promo applied to selected products'));
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

        // Per-tenant notification email (requires auth)
        const token = sessionStorage.getItem('adminToken');
        if (token) {
            const profileRes = await fetch(`${API_URL}/restaurants/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (profileRes.ok) {
                const profile = await profileRes.json();
                const emailInput = document.getElementById('restaurant-notification-email-input');
                if (emailInput) {
                    emailInput.value = profile.orderNotificationEmail || profile.email || '';
                }

                // Email templates
                const orderPlacedSubjectEl = document.getElementById('email-template-order-placed-subject');
                const orderPlacedBodyEl = document.getElementById('email-template-order-placed-body');
                const tpl = profile.emailTemplates?.orderPlaced || {};
                if (orderPlacedSubjectEl) orderPlacedSubjectEl.value = tpl.subject || '';
                if (orderPlacedBodyEl) orderPlacedBodyEl.value = tpl.body || '';

                const boricaEnabledEl = document.getElementById('borica-enabled');
                const boricaModeEl = document.getElementById('borica-mode');
                const boricaTerminalEl = document.getElementById('borica-terminal-id');
                const boricaMerchantEl = document.getElementById('borica-merchant-id');
                const boricaMerchNameEl = document.getElementById('borica-merch-name');
                const boricaMerchUrlEl = document.getElementById('borica-merch-url');
                const boricaBackrefEl = document.getElementById('borica-backref-url');
                const boricaGwTestEl = document.getElementById('borica-gateway-test');
                const boricaGwProdEl = document.getElementById('borica-gateway-prod');
                const boricaPrivEl = document.getElementById('borica-private-key');
                const boricaPubEl = document.getElementById('borica-public-cert');

                const borica = profile.borica || {};
                if (boricaEnabledEl) boricaEnabledEl.checked = !!borica.enabled;
                if (boricaModeEl) {
                    const mode = (borica.mode || (borica.debugMode ? 'test' : 'prod') || 'test').toString().toLowerCase();
                    boricaModeEl.value = (mode === 'prod' || mode === 'production') ? 'prod' : 'test';
                }
                if (boricaTerminalEl) boricaTerminalEl.value = borica.terminalId || '';
                if (boricaMerchantEl) boricaMerchantEl.value = borica.merchantId || '';
                if (boricaMerchNameEl) boricaMerchNameEl.value = borica.merchName || '';
                if (boricaMerchUrlEl) boricaMerchUrlEl.value = borica.merchUrl || '';
                if (boricaBackrefEl) boricaBackrefEl.value = borica.backrefUrl || '';
                if (boricaGwTestEl) boricaGwTestEl.value = borica.gatewayBaseUrlTest || '';
                if (boricaGwProdEl) boricaGwProdEl.value = borica.gatewayBaseUrlProd || '';
                if (boricaPrivEl) boricaPrivEl.value = borica.privateKeyPem || '';
                if (boricaPubEl) boricaPubEl.value = borica.publicCertPem || '';
            }
        }
    } catch (error) {
        console.error('Error loading restaurant settings:', error);
    }
}

async function loadSiteSettings() {
    try {
        const res = await fetch(`${API_URL}/settings/site`);
        if (!res.ok) return;
        const data = await res.json();

        const modeEl = document.getElementById('site-search-mode');
        if (modeEl) modeEl.value = data?.search?.mode === 'names_only' ? 'names_only' : 'names_and_descriptions';

        const webmailUrlEl = document.getElementById('site-webmail-url');
        if (webmailUrlEl) webmailUrlEl.value = data?.email?.webmailUrl || '';

        const phoneEl = document.getElementById('site-footer-phone');
        const emailEl = document.getElementById('site-footer-email');
        const addressEl = document.getElementById('site-footer-address');
        const addressMapsUrlEl = document.getElementById('site-footer-address-maps-url');
        const aboutEl = document.getElementById('site-footer-about');

        if (phoneEl) phoneEl.value = data?.footer?.contacts?.phone || '';
        if (emailEl) emailEl.value = data?.footer?.contacts?.email || '';
        if (addressEl) addressEl.value = data?.footer?.contacts?.address || '';
        if (addressMapsUrlEl) addressMapsUrlEl.value = data?.footer?.contacts?.addressMapsUrl || '';
        if (aboutEl) aboutEl.value = data?.footer?.aboutText || '';

        const mapEnabledEl = document.getElementById('site-map-enabled');
        const mapLabelEl = document.getElementById('site-map-label');
        const mapLatEl = document.getElementById('site-map-lat');
        const mapLngEl = document.getElementById('site-map-lng');
        const mapZoomEl = document.getElementById('site-map-zoom');

        const map = data?.map || {};
        if (mapEnabledEl) mapEnabledEl.checked = !!map.enabled;
        if (mapLabelEl) mapLabelEl.value = (map.label || '').toString();
        if (mapLatEl) mapLatEl.value = (map.lat ?? '').toString();
        if (mapLngEl) mapLngEl.value = (map.lng ?? '').toString();
        if (mapZoomEl) mapZoomEl.value = (map.zoom ?? '').toString();

        const socials = Array.isArray(data?.footer?.socials) ? data.footer.socials : [];
        const setSocial = (i, social) => {
            const labelEl = document.getElementById(`site-social-${i}-label`);
            const urlEl = document.getElementById(`site-social-${i}-url`);
            const iconEl = document.getElementById(`site-social-${i}-icon`);
            if (labelEl) labelEl.value = social?.label || '';
            if (urlEl) urlEl.value = social?.url || '';
            if (iconEl) iconEl.value = social?.iconClass || '';
        };
        setSocial(1, socials[0]);
        setSocial(2, socials[1]);
        setSocial(3, socials[2]);

        const privacyEl = document.getElementById('site-privacy-html');
        const termsEl = document.getElementById('site-terms-html');
        if (privacyEl) privacyEl.value = data?.legal?.privacyHtml || '';
        if (termsEl) termsEl.value = data?.legal?.termsHtml || '';
    } catch (e) {
        console.error('Error loading site settings:', e);
    }
}

function openWebmail() {
    const url = (document.getElementById('site-webmail-url')?.value || '').toString().trim();
    if (!url) {
        alert(t('webmailUrlHelp', 'Optional. If set, admins can open Roundcube webmail in a new tab.'));
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
}

async function updateSiteSettings() {
    try {
        const token = getAdminToken();
        if (!token) {
            window.location.href = `${BASE_PATH}/login`;
            return;
        }

        const mode = (document.getElementById('site-search-mode')?.value || 'names_and_descriptions').toString();
        const webmailUrl = (document.getElementById('site-webmail-url')?.value || '').toString();
        const phone = (document.getElementById('site-footer-phone')?.value || '').toString();
        const email = (document.getElementById('site-footer-email')?.value || '').toString();
        const address = (document.getElementById('site-footer-address')?.value || '').toString();
        const addressMapsUrl = (document.getElementById('site-footer-address-maps-url')?.value || '').toString();
        const aboutText = (document.getElementById('site-footer-about')?.value || '').toString();

        const mapEnabled = !!document.getElementById('site-map-enabled')?.checked;
        const mapLabel = (document.getElementById('site-map-label')?.value || '').toString();
        const mapLatRaw = (document.getElementById('site-map-lat')?.value || '').toString();
        const mapLngRaw = (document.getElementById('site-map-lng')?.value || '').toString();
        const mapZoomRaw = (document.getElementById('site-map-zoom')?.value || '').toString();

        const parseFlexibleNumber = (raw) => {
            const s = (raw || '').toString().trim();
            if (!s) return null;
            const normalized = s.replace(',', '.');
            const n = Number(normalized);
            return Number.isFinite(n) ? n : null;
        };

        const mapLat = parseFlexibleNumber(mapLatRaw);
        const mapLng = parseFlexibleNumber(mapLngRaw);
        const mapZoom = parseFlexibleNumber(mapZoomRaw);

        if (mapEnabled) {
            if (!Number.isFinite(mapLat) || !Number.isFinite(mapLng)) {
                alert(t('siteMapInvalidLatLng', 'Map is enabled but Latitude/Longitude are invalid.'));
                return;
            }
        }

        const buildSocial = (i) => {
            const label = (document.getElementById(`site-social-${i}-label`)?.value || '').toString();
            const url = (document.getElementById(`site-social-${i}-url`)?.value || '').toString();
            const iconClass = (document.getElementById(`site-social-${i}-icon`)?.value || '').toString();
            const trimmedUrl = url.trim();
            if (!trimmedUrl) return null;
            return { label: label.trim(), url: trimmedUrl, iconClass: iconClass.trim() };
        };
        const socials = [buildSocial(1), buildSocial(2), buildSocial(3)].filter(Boolean);

        const privacyHtml = (document.getElementById('site-privacy-html')?.value || '').toString();
        const termsHtml = (document.getElementById('site-terms-html')?.value || '').toString();

        const payload = {
            search: { mode: mode === 'names_only' ? 'names_only' : 'names_and_descriptions' },
            map: {
                enabled: mapEnabled,
                label: mapLabel,
                lat: mapLat,
                lng: mapLng,
                zoom: mapZoom
            },
            email: { webmailUrl },
            footer: {
                contacts: { phone, email, address, addressMapsUrl },
                aboutText,
                socials
            },
            legal: { privacyHtml, termsHtml }
        };

        const res = await fetch(`${API_URL}/settings/site`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (res.status === 401) {
            alert(t('sessionExpired', 'Session expired. Please login again.'));
            window.location.href = `${BASE_PATH}/login`;
            return;
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.error || t('siteSettingsSaveFailed', 'Failed to save site settings'));
            return;
        }

        alert(t('siteSettingsSaved', 'Site content saved successfully!'));
    } catch (e) {
        console.error('Error saving site settings:', e);
        alert(t('siteSettingsSaveError', 'Error saving site settings'));
    }
}

// Update restaurant settings (name and logo)
async function updateRestaurantSettings() {
    const name = document.getElementById('restaurant-name-input').value.trim();
    const logo = document.getElementById('restaurant-logo-input').value.trim();
    const notificationEmail = (document.getElementById('restaurant-notification-email-input')?.value || '').toString().trim();

    const orderPlacedSubject = (document.getElementById('email-template-order-placed-subject')?.value || '').toString();
    const orderPlacedBody = (document.getElementById('email-template-order-placed-body')?.value || '').toString();

    const boricaEnabled = !!document.getElementById('borica-enabled')?.checked;
    const boricaMode = (document.getElementById('borica-mode')?.value || 'test').toString().toLowerCase();
    const boricaDebugMode = boricaMode !== 'prod';
    const boricaTerminalId = (document.getElementById('borica-terminal-id')?.value || '').toString().trim();
    const boricaMerchantId = (document.getElementById('borica-merchant-id')?.value || '').toString().trim();
    const boricaMerchName = (document.getElementById('borica-merch-name')?.value || '').toString().trim();
    const boricaMerchUrl = (document.getElementById('borica-merch-url')?.value || '').toString().trim();
    const boricaBackrefUrl = (document.getElementById('borica-backref-url')?.value || '').toString().trim();
    const boricaGatewayTest = (document.getElementById('borica-gateway-test')?.value || '').toString().trim();
    const boricaGatewayProd = (document.getElementById('borica-gateway-prod')?.value || '').toString().trim();
    const boricaPrivateKeyPem = (document.getElementById('borica-private-key')?.value || '').toString();
    const boricaPublicCertPem = (document.getElementById('borica-public-cert')?.value || '').toString();
    
    if (!name) {
        alert('Please enter a restaurant name');
        return;
    }
    
    try {
        const token = getAdminToken();
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
        
        if (!response.ok) {
            alert('Failed to update restaurant settings');
            return;
        }

        // Save per-tenant notification email (optional but recommended)
        if (token) {
            const profileRes = await fetch(`${API_URL}/restaurants/me`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    orderNotificationEmail: notificationEmail,
                    emailTemplates: {
                        orderPlaced: {
                            subject: orderPlacedSubject,
                            body: orderPlacedBody
                        }
                    },
                    borica: {
                        enabled: boricaEnabled,
                        mode: boricaMode === 'prod' ? 'prod' : 'test',
                        debugMode: boricaDebugMode,
                        terminalId: boricaTerminalId,
                        merchantId: boricaMerchantId,
                        merchName: boricaMerchName,
                        merchUrl: boricaMerchUrl,
                        backrefUrl: boricaBackrefUrl,
                        gatewayBaseUrlTest: boricaGatewayTest,
                        gatewayBaseUrlProd: boricaGatewayProd,
                        privateKeyPem: boricaPrivateKeyPem,
                        publicCertPem: boricaPublicCertPem
                    }
                })
            });

            if (!profileRes.ok) {
                let errText = '';
                try {
                    const ct = (profileRes.headers.get('content-type') || '').toLowerCase();
                    if (ct.includes('application/json')) {
                        const err = await profileRes.json().catch(() => ({}));
                        errText = (err && (err.error || err.message)) ? String(err.error || err.message) : '';
                    } else {
                        errText = ((await profileRes.text()) || '').toString().trim();
                    }
                } catch (e) {
                    // ignore
                }

                const fallback = `Failed to update card payment settings (HTTP ${profileRes.status})`;
                alert(errText || fallback);
                return;
            }
        }

        alert('Restaurant settings updated successfully!');
    } catch (error) {
        console.error('Error updating restaurant settings:', error);
        alert('Error updating restaurant settings');
    }
}

// -------------------- SMTP / Email diagnostics (admin) --------------------

function formatEmailDiagnostics(diag) {
    if (!diag) return 'No diagnostics available.';

    const enabled = !!diag.enabled;
    const missing = Array.isArray(diag.missing) ? diag.missing : [];
    const smtp = diag.smtp || {};

    const lines = [];
    lines.push(`Enabled: ${enabled ? 'YES' : 'NO'}`);
    if (!enabled && missing.length) {
        lines.push(`Missing: ${missing.join(', ')}`);
    }

    if (smtp.host) lines.push(`Host: ${smtp.host}`);
    if (smtp.port != null) lines.push(`Port: ${smtp.port}`);
    if (smtp.secure != null) lines.push(`Secure: ${smtp.secure ? 'true' : 'false'}`);
    if (smtp.from) lines.push(`From: ${smtp.from}`);
    if (smtp.replyTo) lines.push(`Reply-To: ${smtp.replyTo}`);

    if (smtp.credsSource) lines.push(`Credentials: ${smtp.credsSource}`);
    if (smtp.credsFile) lines.push(`Creds file: ${smtp.credsFile} (exists=${smtp.credsFileExists ? 'true' : 'false'})`);
    lines.push(`User present: ${smtp.userPresent ? 'true' : 'false'}`);
    lines.push(`Pass present: ${smtp.passPresent ? 'true' : 'false'}`);

    return lines.join('\n');
}

async function refreshEmailStatus() {
    const box = document.getElementById('smtp-status-box');
    if (box) box.textContent = 'Loading SMTP status...';

    try {
        const token = getAdminToken();
        const res = await fetch(`${API_URL}/email/status`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
            if (box) box.textContent = payload?.error || 'Failed to load email status';
            return;
        }

        if (box) {
            box.style.whiteSpace = 'pre-wrap';
            box.textContent = formatEmailDiagnostics(payload);
        }
    } catch (e) {
        console.error('refreshEmailStatus failed:', e);
        if (box) box.textContent = 'Failed to load email status';
    }
}

async function sendSmtpTestEmail() {
    const to = (document.getElementById('smtp-test-to')?.value || '').toString().trim();
    const box = document.getElementById('smtp-status-box');
    if (box) box.textContent = 'Sending test email...';

    try {
        const token = getAdminToken();
        const res = await fetch(`${API_URL}/email/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ to })
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok || !payload?.success) {
            const diagText = payload?.diagnostics ? formatEmailDiagnostics(payload.diagnostics) : '';
            const errText = payload?.error || 'SMTP test failed';
            if (box) {
                box.style.whiteSpace = 'pre-wrap';
                box.textContent = [errText, payload?.stage ? `Stage: ${payload.stage}` : '', payload?.code ? `Code: ${payload.code}` : '', payload?.response ? `Response: ${payload.response}` : '', diagText].filter(Boolean).join('\n');
            }
            return;
        }

        if (box) {
            box.style.whiteSpace = 'pre-wrap';
            box.textContent = `Test email sent successfully.\nMessageId: ${payload?.send?.messageId || 'n/a'}\n\n${formatEmailDiagnostics(payload.diagnostics)}`;
        }
    } catch (e) {
        console.error('sendSmtpTestEmail failed:', e);
        if (box) box.textContent = 'SMTP test failed';
    }
}

async function sendAdminEmail() {
    const to = (document.getElementById('smtp-send-to')?.value || '').toString().trim();
    const subject = (document.getElementById('smtp-send-subject')?.value || '').toString().trim();
    const text = (document.getElementById('smtp-send-body')?.value || '').toString();
    const box = document.getElementById('smtp-status-box');

    if (box) box.textContent = 'Sending email...';

    try {
        const token = getAdminToken();

        const res = await fetch(`${API_URL}/email/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ to, subject, text })
        });

        const payload = await res.json().catch(() => ({}));

        if (!res.ok || !payload?.success) {
            const diagText = payload?.diagnostics ? formatEmailDiagnostics(payload.diagnostics) : '';
            const errText = payload?.error || 'Failed to send email';
            if (box) {
                box.style.whiteSpace = 'pre-wrap';
                box.textContent = [errText, payload?.code ? `Code: ${payload.code}` : '', payload?.response ? `Response: ${payload.response}` : '', diagText].filter(Boolean).join('\n');
            }
            return;
        }

        if (box) {
            box.style.whiteSpace = 'pre-wrap';
            box.textContent = `Email sent successfully.\nMessageId: ${payload?.messageId || 'n/a'}`;
        }
    } catch (e) {
        console.error('sendAdminEmail failed:', e);
        if (box) box.textContent = 'Failed to send email';
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

function maybeEnableEmailDiagnosticsPanel() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const enabled = params.get('debugEmail') === '1';
        const panel = document.getElementById('email-diagnostics-panel');
        if (panel) panel.style.display = enabled ? 'block' : 'none';
    } catch {
        // ignore
    }
}

async function uploadImageToServer(file) {
    if (!file) return null;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        alert('File is too large. Maximum size is 5MB.');
        return null;
    }

    const token = getAdminToken();
    if (!token) {
        alert('Session expired. Please login again.');
        window.location.href = `${BASE_PATH}/login`;
        return null;
    }

    try {
        const formData = new FormData();
        formData.append('image', file);

        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.status === 401) {
            alert('Session expired. Please login again.');
            window.location.href = `${BASE_PATH}/login`;
            return null;
        }

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            alert(err.error || 'Failed to upload image');
            return null;
        }

        const data = await response.json().catch(() => ({}));
        const imageUrl = (data && data.imageUrl) ? String(data.imageUrl) : '';
        if (!imageUrl) {
            alert('Failed to upload image');
            return null;
        }

        return imageUrl;
    } catch (error) {
        console.error('Error uploading image:', error);
        alert('Error uploading image');
        return null;
    }
}

async function handleRestaurantLogoUpload(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const imageUrl = await uploadImageToServer(file);
    if (imageUrl) {
        const logoInput = document.getElementById('restaurant-logo-input');
        if (logoInput) logoInput.value = imageUrl;
        alert(t('imageUploaded', 'Image uploaded successfully!'));
    }

    if (event?.target) event.target.value = '';
}

async function handleBackgroundImageUpload(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;

    const imageUrl = await uploadImageToServer(file);
    if (imageUrl) {
        const bgInput = document.getElementById('background-image');
        if (bgInput) bgInput.value = imageUrl;
        alert(t('imageUploaded', 'Image uploaded successfully!'));
    }

    if (event?.target) event.target.value = '';
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
    document.getElementById('form-title').textContent = t('addNewProduct', 'Add New Product');
    document.getElementById('submit-text').textContent = t('addProduct', 'Add Product');
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
        if (pageInfo) pageInfo.textContent = t('pageInfoEmpty', 'Page 0 of 0');
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
            const promoDisplay = hasPromo ? `${product.promo.price.toFixed(2)} €` : '-';
            const priceDisplay = `${(product.price ?? 0).toFixed(2)} €`;

            return `
                <tr>
                    <td style="width:40px;" data-label="${t('select', 'Select')}">
                        <input type="checkbox" ${manageSelected.has(product.id) ? 'checked' : ''} onclick="toggleManageSelect(${product.id}, this.checked)">
                    </td>
                    <td data-label="ID">${product.id}</td>
                    <td data-label="${t('enName', 'EN Name')}">${enName}</td>
                    <td data-label="${t('bgName', 'BG Name')}">${bgName}</td>
                    <td data-label="${t('category', 'Category')}"><span class="product-category">${category}</span></td>
                    <td data-label="${t('price', 'Price')}"><span class="product-price">${priceDisplay}</span></td>
                    <td data-label="Promo">${hasPromo ? `<span class="product-price" style="background:#e74c3c; color:#fff; padding:4px 8px; border-radius:6px; font-weight:700;">${promoDisplay}</span>` : '-'}</td>
                    <td data-label="${t('image', 'Image')}">
                        ${imageUrl ? `<img src="${imageUrl}" alt="${enName}" class="product-img-thumb" onerror="this.src='https://via.placeholder.com/80x80?text=No+Image'">` : `<img src="https://via.placeholder.com/80x80?text=No+Image" alt="${enName}" class="product-img-thumb">`}
                    </td>
                    <td data-label="${t('actions', 'Actions')}">
                        <div class="product-actions">
                            <button onclick="editProduct(${product.id})" class="btn btn-primary btn-small">
                                <i class="fas fa-edit"></i> ${t('edit', 'Edit')}
                            </button>
                            <button onclick="deleteProduct(${product.id})" class="btn btn-danger btn-small">
                                <i class="fas fa-trash"></i> ${t('delete', 'Delete')}
                            </button>
                        </div>
                    </td>
                </tr>
            `;
    }).join('');
    
    // Update page info
    if (pageInfo) {
        pageInfo.textContent = t('pageInfoProducts', `Page ${manageCurrentPage} of ${totalPages} (${filteredProducts.length} products)`)
            .replace('{current}', String(manageCurrentPage))
            .replace('{total}', String(totalPages))
            .replace('{count}', String(filteredProducts.length));
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
    select.innerHTML = `<option value="all">${t('allCategories', 'All Categories')}</option>`;
    
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

// Update manage category dropdown for bulk promo
function updateManageCategoryDropdown() {
    const select = document.getElementById('manage-category-select');
    if (!select) return;
    
    const categories = [...new Set(products.map(p => p.category))].sort();
    const currentValue = select.value;
    
    select.innerHTML = `<option value="">${t('selectCategoryPlaceholder', 'Select category...')}</option>`;
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
        'id',
        'code',
        'name',
        'category',
        'subcategory',
        'price',
        'promo_price',
        'promo_percentage',
        'is_promo',
        'availability',
        'img_url',
        'info'
    ];

    const exampleRow = [
        '',
        'PIZZA_MARGHERITA',
        'Margherita Pizza',
        'Pizza',
        'Classic',
        '12.99',
        '9.99',
        '23',
        'true',
        'true',
        'https://example.com/pizza.jpg',
        'Classic pizza with tomato sauce, mozzarella and basil'
    ];

    const quote = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
    const emptyRow = headers.map(() => '').join(',');
    const csvContent = [
        headers.join(','),
        exampleRow.map(quote).join(','),
        emptyRow,
        emptyRow
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'products-template.csv';
    link.click();
    URL.revokeObjectURL(url);
    
    alert('Template downloaded! Fill it with your products and upload it back.');
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
            'id',
            'code',
            'name',
            'category',
            'subcategory',
            'price',
            'promo_price',
            'promo_percentage',
            'is_promo',
            'availability',
            'img_url',
            'info'
        ];

        const rows = products.map(p => {
            const price = Number(p.price) || 0;
            const isPromo = !!(p.promo && p.promo.isActive);
            const promoPrice = isPromo ? (Number(p.promo?.price) || '') : '';
            const pct = (isPromo && promoPrice !== '' && price > 0)
                ? Math.round(((price - Number(promoPrice)) / price) * 100)
                : (p.promoPercentage != null ? Number(p.promoPercentage) : '');

            return [
                p.id ?? '',
                p.code ?? '',
                p.name ?? '',
                p.category ?? '',
                p.subcategory ?? '',
                price ? price : '',
                promoPrice,
                (Number.isFinite(pct) ? pct : ''),
                isPromo ? 'true' : 'false',
                (p.availability == null ? 'true' : (p.availability ? 'true' : 'false')),
                p.image ?? '',
                p.description ?? ''
            ];
        });
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
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
            const lines = csvText.split(/\r?\n/).filter(line => line.trim());
            
            if (lines.length < 2) {
                alert('CSV file is empty or invalid!');
                return;
            }

            const headerLine = lines[0];
            const delimiter = (headerLine.split(';').length > headerLine.split(',').length) ? ';' : ',';
            const headers = parseCSVLine(headerLine, delimiter).map(h => h.trim().replace(/^"|"$/g, ''));

            const idx = Object.fromEntries(headers.map((h, i) => [h, i]));
            const required = ['code', 'name', 'category', 'price'];
            const missing = required.filter(k => !(k in idx));
            if (missing.length) {
                alert(`Missing required columns: ${missing.join(', ')}`);
                return;
            }

            // Load existing products so we can skip duplicates by code
            const existingRes = await fetch(`${API_URL}/products`);
            const existingProducts = await existingRes.json().catch(() => []);
            const existingCodes = new Set((existingProducts || [])
                .map(p => (p?.code ?? '').toString().trim().toLowerCase())
                .filter(Boolean));

            const products = [];
            let duplicateCount = 0;
            
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i], delimiter);
                if (!values || values.length === 0) continue;

                const codeRaw = (values[idx.code] ?? '').toString().trim();
                const codeNorm = codeRaw.toLowerCase();
                if (!codeRaw) continue;
                if (existingCodes.has(codeNorm)) {
                    duplicateCount++;
                    continue;
                }

                const idRaw = (idx.id != null ? (values[idx.id] ?? '') : '').toString().trim();
                const idNum = idRaw ? Number(idRaw) : NaN;
                const id = Number.isFinite(idNum) ? idNum : undefined;

                const name = (values[idx.name] ?? '').toString().trim();
                const category = (values[idx.category] ?? '').toString().trim() || 'Other';
                const subcategory = (idx.subcategory != null ? (values[idx.subcategory] ?? '').toString().trim() : '');
                const price = Number(values[idx.price]);
                if (!Number.isFinite(price) || price <= 0) continue;

                const imgUrl = (idx.img_url != null ? (values[idx.img_url] ?? '').toString().trim() : '')
                    || 'https://via.placeholder.com/300x200?text=No+Image';
                const info = (idx.info != null ? (values[idx.info] ?? '').toString() : '');

                const promoPriceRaw = (idx.promo_price != null ? (values[idx.promo_price] ?? '').toString().trim() : '');
                const promoPctRaw = (idx.promo_percentage != null ? (values[idx.promo_percentage] ?? '').toString().trim() : '');
                const isPromoRaw = (idx.is_promo != null ? (values[idx.is_promo] ?? '').toString().trim() : '');
                const availabilityRaw = (idx.availability != null ? (values[idx.availability] ?? '').toString().trim() : '');

                const promoPct = promoPctRaw ? Number(promoPctRaw) : NaN;
                let promoPrice = promoPriceRaw ? Number(promoPriceRaw) : NaN;
                const isPromo = parseBoolLike(isPromoRaw) || (promoPriceRaw !== '') || (promoPctRaw !== '');
                if (isPromo && !Number.isFinite(promoPrice) && Number.isFinite(promoPct) && promoPct > 0) {
                    promoPrice = Math.round((price * (1 - Math.max(0, Math.min(100, promoPct)) / 100)) * 100) / 100;
                }

                const availability = availabilityRaw ? parseBoolLike(availabilityRaw) : true;

                const product = {
                    code: codeRaw,
                    name,
                    category,
                    subcategory,
                    price,
                    image: imgUrl,
                    description: info,
                    availability,
                    promoPercentage: Number.isFinite(promoPct) ? promoPct : undefined
                };

                if (id != null) {
                    product.id = id;
                }

                if (isPromo && Number.isFinite(promoPrice) && promoPrice > 0) {
                    product.promo = {
                        isActive: true,
                        price: promoPrice,
                        type: 'permanent',
                        startDate: null,
                        endDate: null
                    };
                }

                products.push(product);
                existingCodes.add(codeNorm);
            }
            
            if (products.length === 0) {
                alert('No valid products found in CSV file!');
                return;
            }
            
            if (!confirm(`Found ${products.length} new product(s) in CSV.\nSkipped duplicates by code: ${duplicateCount}.\nImport them now?`)) {
                return;
            }
            
            // Import products
            const token = sessionStorage.getItem('adminToken');
            let successCount = 0;
            let errorCount = 0;
            let skippedDuplicates = duplicateCount;
            
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
            
            alert(`Import completed!\nImported: ${successCount}\nSkipped duplicates: ${skippedDuplicates}\nFailed: ${errorCount}`);
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
function parseCSVLine(line, delimiter = ',') {
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
        } else if (char === delimiter && !inQuotes) {
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
            alert(t('customizationUpdated', 'Customization updated successfully!'));
        } else {
            alert(t('customizationFailedUpdate', 'Failed to update customization'));
        }
    } catch (error) {
        console.error('Error updating customization:', error);
        alert(t('customizationErrorUpdate', 'Error updating customization'));
    }
}

// Currency Settings removed: storefront is EUR-only.

// ========== ORDER SETTINGS FUNCTIONS ==========

async function updateOrderSettings() {
    const token = sessionStorage.getItem('adminToken');
    if (!token) {
        alert('Please login first');
        return;
    }

    const orderSettings = {
        minimumOrderAmount: parseFloat(document.getElementById('minimum-order-amount').value) || 0,
        allowOrderLater: document.getElementById('allow-order-later')?.checked !== false,
        temporarilyClosed: document.getElementById('restaurant-temporarily-closed')?.checked === true,
        pickupEnabled: document.getElementById('pickup-enabled')?.checked !== false
    };

    try {
        const response = await fetch(`${API_URL}/settings/order`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderSettings)
        });

        if (response.ok) {
            alert(t('orderSettingsUpdated', 'Order settings updated successfully!'));
        } else {
            alert(t('orderSettingsFailedUpdate', 'Failed to update order settings'));
        }
    } catch (error) {
        console.error('Error updating order settings:', error);
        alert(t('orderSettingsErrorUpdate', 'Error updating order settings'));
    }
}

async function loadOrderSettings() {
    try {
        const response = await fetch(`${API_URL}/settings/order`);
        const settings = await response.json();
        
        document.getElementById('minimum-order-amount').value = settings.minimumOrderAmount || 0;

        const allowLaterEl = document.getElementById('allow-order-later');
        if (allowLaterEl) allowLaterEl.checked = settings.allowOrderLater !== false;

        const tempClosedEl = document.getElementById('restaurant-temporarily-closed');
        if (tempClosedEl) tempClosedEl.checked = settings.temporarilyClosed === true;

        const pickupEnabledEl = document.getElementById('pickup-enabled');
        if (pickupEnabledEl) pickupEnabledEl.checked = settings.pickupEnabled !== false;
    } catch (error) {
        console.error('Error loading order settings:', error);
    }
}

// ========== WORKING HOURS FUNCTIONS ==========

// Update working hours
async function updateWorkingHours() {
    const workingHours = {
        openingTime: document.getElementById('opening-time').value,
        closingTime: document.getElementById('closing-time').value
    };

    try {
        const token = sessionStorage.getItem('adminToken') || '';
        const response = await fetch(`${API_URL}/settings/working-hours`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(workingHours)
        });

        if (response.ok) {
            alert(t('workingHoursUpdated', 'Working hours updated successfully!'));
        } else {
            alert(t('workingHoursFailedUpdate', 'Failed to update working hours'));
        }
    } catch (error) {
        console.error('Error updating working hours:', error);
        alert(t('workingHoursErrorUpdate', 'Error updating working hours'));
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

// ========== PRINTER SETTINGS FUNCTIONS ==========

function getPrinterFormValue() {
    const enabled = !!document.getElementById('printer-enabled')?.checked;
    const ip = (document.getElementById('printer-ip')?.value || '').toString().trim();
    const port = Number(document.getElementById('printer-port')?.value || 9100);
    const autoPrintOnApproved = !!document.getElementById('printer-auto-print-approved')?.checked;
    const printPickup = !!document.getElementById('printer-print-pickup')?.checked;
    const allowAutoDiscovery = !!document.getElementById('printer-allow-auto-discovery')?.checked;

    return {
        enabled,
        ip,
        port: Number.isFinite(port) ? port : 9100,
        autoPrintOnApproved,
        printPickup,
        allowAutoDiscovery
    };
}

function applyPrinterToForm(printer) {
    const cfg = printer || {};
    const enabledEl = document.getElementById('printer-enabled');
    const ipEl = document.getElementById('printer-ip');
    const portEl = document.getElementById('printer-port');
    const autoEl = document.getElementById('printer-auto-print-approved');
    const pickupEl = document.getElementById('printer-print-pickup');
    const discoveryEl = document.getElementById('printer-allow-auto-discovery');

    if (enabledEl) enabledEl.checked = !!cfg.enabled;
    if (ipEl) ipEl.value = (cfg.ip || '').toString();
    if (portEl) portEl.value = (cfg.port != null ? String(cfg.port) : '9100');
    if (autoEl) autoEl.checked = cfg.autoPrintOnApproved !== false;
    if (pickupEl) pickupEl.checked = cfg.printPickup !== false;
    if (discoveryEl) discoveryEl.checked = !!cfg.allowAutoDiscovery;
}

function fillPrinterScanResults(printers) {
    const select = document.getElementById('printer-scan-results');
    if (!select) return;
    const list = Array.isArray(printers) ? printers : [];

    if (list.length === 0) {
        select.innerHTML = '<option value="">No printers found</option>';
        return;
    }

    select.innerHTML = ['<option value="">-- Select printer --</option>', ...list.map(p => {
        const ip = (p?.ip || '').toString();
        const name = (p?.name || `Network Printer at ${ip}`).toString();
        const port = (p?.port != null ? p.port : 9100);
        return `<option value="${escapeHtml(ip)}" data-port="${escapeHtml(String(port))}">${escapeHtml(name)} (${escapeHtml(ip)}:${escapeHtml(String(port))})</option>`;
    })].join('');

    select.onchange = () => {
        const ip = (select.value || '').toString().trim();
        if (!ip) return;
        const opt = select.options[select.selectedIndex];
        const port = opt?.getAttribute('data-port') || '9100';
        const ipEl = document.getElementById('printer-ip');
        const portEl = document.getElementById('printer-port');
        if (ipEl) ipEl.value = ip;
        if (portEl) portEl.value = port;
    };
}

async function loadPrinterSettings() {
    try {
        const token = getAdminToken();
        if (!token) return;

        const res = await fetch(`${API_URL}/restaurants/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const profile = await res.json().catch(() => ({}));
        applyPrinterToForm(profile?.printer || null);
    } catch (e) {
        console.error('Error loading printer settings:', e);
    }
}

async function revealRestaurantApiKey() {
    try {
        const token = getAdminToken();
        if (!token) {
            window.location.href = `${BASE_PATH}/login`;
            return;
        }

        const input = document.getElementById('restaurant-api-key');
        if (!input) return;

        const res = await fetch(`${API_URL}/restaurants/me/api-key`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(out?.error || 'Failed to load API key');
            return;
        }

        input.type = 'text';
        input.value = (out?.apiKey || '').toString();

        // auto-hide after 30s
        setTimeout(() => {
            try {
                if (input.type === 'text') input.type = 'password';
            } catch {}
        }, 30000);
    } catch (e) {
        console.error('revealRestaurantApiKey failed:', e);
        alert('Failed to load API key');
    }
}

async function copyRestaurantApiKey() {
    const input = document.getElementById('restaurant-api-key');
    const value = (input?.value || '').toString().trim();
    if (!value) {
        alert('Click Show first');
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        alert('API key copied');
    } catch {
        try {
            input.type = 'text';
            input.focus();
            input.select();
            document.execCommand('copy');
            input.type = 'password';
            alert('API key copied');
        } catch {
            alert('Copy failed');
        }
    }
}

async function savePrinterSettings() {
    try {
        const token = getAdminToken();
        if (!token) {
            window.location.href = `${BASE_PATH}/login`;
            return;
        }

        const payload = { printer: getPrinterFormValue() };

        const res = await fetch(`${API_URL}/restaurants/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const out = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(out?.error || 'Failed to save printer settings');
            return;
        }

        applyPrinterToForm(out?.printer || payload.printer);
        alert(t('printerSaved', 'Printer settings saved.'));
    } catch (e) {
        console.error('savePrinterSettings failed:', e);
        alert('Failed to save printer settings');
    }
}

async function scanPrinters() {
    try {
        const token = getAdminToken();
        if (!token) {
            window.location.href = `${BASE_PATH}/login`;
            return;
        }

        const subnet = (document.getElementById('printer-subnet')?.value || '').toString().trim();
        const port = (document.getElementById('printer-port')?.value || '').toString().trim();

        const qs = new URLSearchParams();
        if (subnet) qs.set('subnet', subnet);
        if (port) qs.set('port', port);

        const res = await fetch(`${API_URL}/printer/find?${qs.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out?.success) {
            alert(out?.error || 'Printer scan failed');
            return;
        }

        fillPrinterScanResults(out.printers || []);
        if (out?.message) {
            alert(out.message);
        } else {
            alert(`Found ${out.count || 0} printer(s)`);
        }
    } catch (e) {
        console.error('scanPrinters failed:', e);
        alert('Printer scan failed');
    }
}

async function autoDetectPrinter() {
    try {
        const token = getAdminToken();
        if (!token) {
            window.location.href = `${BASE_PATH}/login`;
            return;
        }

        const subnet = (document.getElementById('printer-subnet')?.value || '').toString().trim();
        const port = (document.getElementById('printer-port')?.value || '').toString().trim();

        const qs = new URLSearchParams();
        if (subnet) qs.set('subnet', subnet);
        if (port) qs.set('port', port);

        const res = await fetch(`${API_URL}/printer/find?${qs.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out?.success) {
            alert(out?.error || 'Printer auto-detect failed');
            return;
        }

        const printers = Array.isArray(out.printers) ? out.printers : [];
        fillPrinterScanResults(printers);

        if (printers.length === 0) {
            alert(out?.message || 'No printers found');
            return;
        }

        // Prefer the first discovered printer.
        const first = printers[0];
        const ipEl = document.getElementById('printer-ip');
        const portEl = document.getElementById('printer-port');
        if (ipEl) ipEl.value = (first.ip || '').toString();
        if (portEl && first.port != null) portEl.value = String(first.port);

        // If printer is enabled, auto-save to persist immediately.
        const enabled = !!document.getElementById('printer-enabled')?.checked;
        if (enabled) {
            await savePrinterSettings();
        } else {
            alert(`Detected: ${(first.name || 'Printer')} (${first.ip}:${first.port || 9100}). Enable + Save to use it.`);
        }
    } catch (e) {
        console.error('autoDetectPrinter failed:', e);
        alert('Printer auto-detect failed');
    }
}

async function testPrinterConfig() {
    try {
        const token = getAdminToken();
        if (!token) {
            window.location.href = `${BASE_PATH}/login`;
            return;
        }

        const cfg = getPrinterFormValue();
        const qs = new URLSearchParams();
        if (cfg.ip) qs.set('ip', cfg.ip);
        if (cfg.port) qs.set('port', String(cfg.port));

        const res = await fetch(`${API_URL}/printer/test?${qs.toString()}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const out = await res.json().catch(() => ({}));

        if (!res.ok) {
            alert(out?.error || 'Printer test failed');
            return;
        }

        if (out?.success) {
            alert(`Printer OK: ${out?.tested || cfg.ip || ''}`);
        } else {
            alert(out?.error || 'Printer test failed');
        }
    } catch (e) {
        console.error('testPrinterConfig failed:', e);
        alert('Printer test failed');
    }
}

// ========== PROMOTIONAL SLIDESHOW FUNCTIONS ==========

function loadSlideshowSettings() {
    fetch(`${API_URL}/slideshow`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('slideshow-enabled').checked = data.enabled || false;
            document.getElementById('slideshow-interval').value = (data.autoPlayInterval || 5000) / 1000;
            renderSlidesList(data.slides || []);
        })
        .catch(error => {
            console.error('Error loading slideshow settings:', error);
            renderSlidesList([]);
        });
}

function renderSlidesList(slides) {
    const container = document.getElementById('slides-list');
    
    if (slides.length === 0) {
        container.innerHTML = `<p style="color: #666;">${t('slideshowNoSlides', 'No slides added yet. Click "Add Slide" to get started.')}</p>`;
        return;
    }
    
    container.innerHTML = slides.map((slide, index) => `
        <div style="display: flex; gap: 10px; align-items: center; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9; margin-bottom: 10px;">
            <div style="display: flex; flex-direction: column; gap: 5px;">
                <button onclick="moveSlideUp(${index})" class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" ${index === 0 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-up"></i>
                </button>
                <div style="font-weight: bold; text-align: center; color: #666; font-size: 14px;">#${index + 1}</div>
                <button onclick="moveSlideDown(${index})" class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" ${index === slides.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-down"></i>
                </button>
            </div>
            <img src="${slide.image}" style="width: 100px; height: 60px; object-fit: cover; border-radius: 4px;" onerror="this.src='https://via.placeholder.com/100x60?text=No+Image'">
            <div style="flex: 1;">
                <div style="margin-bottom: 5px;">
                    <label style="display: block; font-size: 12px; color: #666; margin-bottom: 3px;">${t('slideshowImageLabel', 'Image')}</label>
                    <input type="file" accept="image/*" onchange="updateSlideImage(${index}, this)" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
                    <div style="font-size: 11px; color: #999; margin-top: 2px;">${t('slideshowCurrentLabel', 'Current:')} ${slide.image}</div>
                </div>
            </div>
            <input type="text" value="${slide.title || ''}" onchange="updateSlideTitle(${index}, this.value)" onblur="updateSlideTitle(${index}, this.value)" placeholder="${t('slideshowTitleOptionalPlaceholder', 'Title (optional)')}" style="width: 200px; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            <button onclick="removeSlide(${index})" class="btn btn-danger" style="padding: 8px 12px;">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function addSlide() {
    fetch(`${API_URL}/slideshow`)
        .then(response => response.json())
        .then(data => {
            let slides = data.slides || [];
            
            // Check max 10 slides
            if (slides.length >= 10) {
                alert(t('slideshowMaxSlides', 'Maximum 10 slides allowed!'));
                throw new Error('Max slides reached');
            }
            
            slides.push({
                image: 'https://via.placeholder.com/1200x400?text=Upload+Image',
                title: ''
            });
            
            // Save to server
            return fetch(`${API_URL}/slideshow`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                    enabled: data.enabled,
                    autoPlayInterval: data.autoPlayInterval,
                    slides: slides
                })
            });
        })
        .then(response => {
            if (!response) return;
            return response.json();
        })
        .then(data => {
            if (data && data.slides) {
                renderSlidesList(data.slides);
            }
        })
        .catch(error => {
            if (error.message !== 'Max slides reached') {
                console.error('Error adding slide:', error);
                alert(t('slideshowFailedAdd', 'Failed to add slide'));
            }
        });
}

function removeSlide(index) {
    if (!confirm(t('slideshowConfirmRemove', 'Are you sure you want to remove this slide?'))) {
        return;
    }
    
    fetch(`${API_URL}/slideshow`)
        .then(response => response.json())
        .then(data => {
            let slides = data.slides || [];
            slides.splice(index, 1);
            
            return fetch(`${API_URL}/slideshow`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                    enabled: data.enabled,
                    autoPlayInterval: data.autoPlayInterval,
                    slides: slides
                })
            });
        })
        .then(response => response.json())
        .then(data => {
            renderSlidesList(data.slides);
        })
        .catch(error => {
            console.error('Error removing slide:', error);
            alert(t('slideshowFailedRemove', 'Failed to remove slide'));
        });
}

function moveSlideUp(index) {
    if (index === 0) return;
    
    fetch(`${API_URL}/slideshow`)
        .then(response => response.json())
        .then(data => {
            let slides = data.slides || [];
            // Swap with previous slide
            [slides[index - 1], slides[index]] = [slides[index], slides[index - 1]];
            
            return fetch(`${API_URL}/slideshow`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                    enabled: data.enabled,
                    autoPlayInterval: data.autoPlayInterval,
                    slides: slides
                })
            });
        })
        .then(response => response.json())
        .then(data => {
            renderSlidesList(data.slides);
        })
        .catch(error => {
            console.error('Error moving slide:', error);
            alert(t('slideshowFailedMove', 'Failed to move slide'));
        });
}

function moveSlideDown(index) {
    fetch(`${API_URL}/slideshow`)
        .then(response => response.json())
        .then(data => {
            let slides = data.slides || [];
            if (index >= slides.length - 1) return;
            
            // Swap with next slide
            [slides[index], slides[index + 1]] = [slides[index + 1], slides[index]];
            
            return fetch(`${API_URL}/slideshow`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                    enabled: data.enabled,
                    autoPlayInterval: data.autoPlayInterval,
                    slides: slides
                })
            });
        })
        .then(response => response.json())
        .then(data => {
            renderSlidesList(data.slides);
        })
        .catch(error => {
            console.error('Error moving slide:', error);
            alert(t('slideshowFailedMove', 'Failed to move slide'));
        });
}

function updateSlideImage(index, fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    
    // Show loading
    fileInput.disabled = true;
    
    // Upload image
    const formData = new FormData();
    formData.append('image', file);
    
    fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
        },
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Upload failed: ${response.status}`);
        }
        return response.json();
    })
    .then(uploadData => {
        if (!uploadData.imageUrl) {
            throw new Error('No image URL in response');
        }
        // Update slide with new image URL
        return fetch(`${API_URL}/slideshow`)
            .then(response => response.json())
            .then(data => {
                let slides = data.slides || [];
                if (slides[index]) {
                    slides[index].image = uploadData.imageUrl;
                }
                
                return fetch(`${API_URL}/slideshow`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
                    },
                    body: JSON.stringify({
                        enabled: data.enabled,
                        autoPlayInterval: data.autoPlayInterval,
                        slides: slides
                    })
                });
            });
    })
    .then(response => response.json())
    .then(data => {
        renderSlidesList(data.slides);
    })
    .catch(error => {
        console.error('Error updating slide image:', error);
        alert(t('slideshowFailedUpload', 'Failed to upload image'));
        fileInput.disabled = false;
    });
}

function updateSlideTitle(index, title) {
    fetch(`${API_URL}/slideshow`)
        .then(response => response.json())
        .then(data => {
            let slides = data.slides || [];
            if (slides[index]) {
                slides[index].title = title;
            }
            
            return fetch(`${API_URL}/slideshow`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                    enabled: data.enabled,
                    autoPlayInterval: data.autoPlayInterval,
                    slides: slides
                })
            });
        })
        .then(response => response.json())
        .then(data => {
            console.log('Title updated successfully');
        })
        .catch(error => {
            console.error('Error updating slide title:', error);
            alert(t('slideshowFailedUpdateTitle', 'Failed to update title'));
        });
}

function saveSlideshowSettings() {
    const enabled = document.getElementById('slideshow-enabled').checked;
    const interval = parseInt(document.getElementById('slideshow-interval').value) * 1000;
    
    fetch(`${API_URL}/slideshow`)
        .then(response => response.json())
        .then(data => {
            return fetch(`${API_URL}/slideshow`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionStorage.getItem('adminToken')}`
                },
                body: JSON.stringify({
                    enabled: enabled,
                    autoPlayInterval: interval,
                    slides: data.slides || []
                })
            });
        })
        .then(response => response.json())
        .then(data => {
            alert(t('slideshowSavedSuccess', 'Slideshow settings saved successfully!'));
        })
        .catch(error => {
            console.error('Error saving slideshow settings:', error);
            alert(t('slideshowFailedSave', 'Failed to save slideshow settings'));
        });
}

function toggleSlideshowPreview() {
    const enabled = document.getElementById('slideshow-enabled').checked;
    document.getElementById('slideshow-interval').disabled = !enabled;
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
                    polygon.bindPopup(`<b>${zone.name}</b><br>€${zone.price}`);
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
                <strong>${zone.name}</strong> - €${zone.price}
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
    select.innerHTML = `<option value="all">${t('allCategories', 'All Categories')}</option>`;
    
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
                    ${t('noPromoCodesYet', 'No promo codes yet. Create one above!')}
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = promoCodes.map(promo => `
        <tr>
            <td data-label="${t('promoTableCode', 'Code')}">
                <strong style="font-family: monospace; color: #667eea;">${promo.code}</strong>
            </td>
            <td data-label="${t('promoTableCategory', 'Category')}">
                <span class="product-category">${promo.category === 'all' ? t('allCategories', 'All Categories') : promo.category}</span>
            </td>
            <td data-label="${t('promoTableDiscount', 'Discount')}">
                <strong style="color: #e74c3c;">${promo.discount}% ${t('off', 'OFF')}</strong>
            </td>
            <td data-label="${t('promoTableStatus', 'Status')}">
                <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; 
                       background: ${promo.isActive ? '#d4edda' : '#f8d7da'}; 
                       color: ${promo.isActive ? '#155724' : '#721c24'};">
                    ${(promo.isActive ? t('active', 'Active') : t('inactive', 'Inactive')).toUpperCase()}
                </span>
            </td>
            <td data-label="${t('actions', 'Actions')}">
                <div class="product-actions">
                    <button onclick="editPromoCode(${promo.id})" class="btn btn-primary btn-small">
                        <i class="fas fa-edit"></i> ${t('edit', 'Edit')}
                    </button>
                    <button onclick="deletePromoCode(${promo.id})" class="btn btn-danger btn-small">
                        <i class="fas fa-trash"></i> ${t('delete', 'Delete')}
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    try { updatePromoFlyersStats(); } catch (e) {}
}

// ========== PROMO FLYERS (CLIENT-SIDE GENERATOR) ==========

function getEligiblePromoCodesForFlyers() {
    return (promoCodes || []).filter(pc => !!pc && pc.isActive && !pc.flyerGenerated);
}

function updatePromoFlyersStats() {
    const eligibleEl = document.getElementById('flyer-eligible-count');
    const printedEl = document.getElementById('flyer-printed-count');
    if (!eligibleEl || !printedEl) return;

    const eligible = getEligiblePromoCodesForFlyers();
    const printed = (promoCodes || []).filter(pc => !!pc && !!pc.flyerGenerated);

    eligibleEl.textContent = String(eligible.length);
    printedEl.textContent = String(printed.length);
}

function setFlyerProgress(text, show = true) {
    const box = document.getElementById('flyer-progress');
    if (!box) return;
    box.style.display = show ? 'block' : 'none';
    if (show) box.textContent = text || '';
}

async function loadImageFromFile(file) {
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.decoding = 'async';
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = url;
        });
        return img;
    } finally {
        try { URL.revokeObjectURL(url); } catch (e) {}
    }
}

function canvasToJpegBlob(canvas, quality = 0.88) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Failed to export image'));
            resolve(blob);
        }, 'image/jpeg', quality);
    });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch (e) {}
    }, 3000);
}

async function markPromoCodesFlyerPrinted(ids) {
    const token = getAdminToken();
    const res = await fetch(`${API_URL}/promo-codes/flyers/mark-printed`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json().catch(() => ({}));
}

async function bulkCreatePromoCodes(count, { discount, category, isActive, codePrefix }) {
    const token = getAdminToken();
    const res = await fetch(`${API_URL}/promo-codes/bulk`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            count,
            discount,
            category,
            isActive,
            codePrefix
        })
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    const payload = await res.json().catch(() => ({}));
    return Array.isArray(payload.promoCodes) ? payload.promoCodes : [];
}

async function generatePromoFlyersZip() {
    const btn = document.getElementById('generate-flyers-btn');
    const fileInput = document.getElementById('flyer-base-image');
    const limitInput = document.getElementById('flyer-limit');
    const generateCountInput = document.getElementById('flyer-generate-count');
    const fontSizeInput = document.getElementById('flyer-font-size');
    const prefixInput = document.getElementById('flyer-text-prefix');
    const codePrefixInput = document.getElementById('flyer-code-prefix');

    if (!fileInput || !btn) return;
    if (!window.JSZip) {
        alert('JSZip is missing. Please refresh the page.');
        return;
    }

    const file = fileInput.files && fileInput.files[0];
    if (!file) {
        alert(t('flyerSelectBaseImage', 'Please select a base image first.'));
        return;
    }

    // Optional: generate N new promo codes first (for large flyer batches, e.g. 1000)
    const rawGenCount = (generateCountInput && generateCountInput.value || '').toString().trim();
    const generateCount = rawGenCount ? Math.max(1, parseInt(rawGenCount, 10) || 0) : 0;

    let eligible = getEligiblePromoCodesForFlyers();

    if (generateCount > 0) {
        const discount = parseFloat(document.getElementById('promo-code-discount')?.value);
        const category = (document.getElementById('promo-code-category')?.value || 'all').toString();
        const isActive = (document.getElementById('promo-code-active')?.value || 'true') === 'true';
        const codePrefix = (codePrefixInput && codePrefixInput.value !== undefined)
            ? String(codePrefixInput.value)
            : 'FLY';

        if (!discount || discount < 1 || discount > 100) {
            alert(t('flyerBulkNeedsDiscount', 'Please set a discount (1-100%) in the Promo Codes form above before generating new flyers.'));
            return;
        }

        btn.disabled = true;
        setFlyerProgress(`${t('flyerGenerating', 'Generating flyers…')} (0/${generateCount})`, true);

        try {
            const created = await bulkCreatePromoCodes(generateCount, { discount, category, isActive, codePrefix });
            promoCodes = (promoCodes || []).concat(created);
            eligible = created.filter(pc => !!pc && pc.isActive && !pc.flyerGenerated);
            try { updatePromoFlyersStats(); } catch (e) {}
        } catch (e) {
            console.error('Bulk create promo codes failed:', e);
            alert(e.message || 'Failed to generate promo codes');
            return;
        } finally {
            btn.disabled = false;
        }
    }

    const rawLimit = (limitInput && limitInput.value || '').toString().trim();
    const limit = rawLimit ? Math.max(1, parseInt(rawLimit, 10) || 0) : null;
    if (limit) eligible = eligible.slice(0, limit);

    if (!eligible.length) {
        alert(t('flyerNoEligibleCodes', 'No eligible promo codes (active + not printed).'));
        return;
    }

    const fontSize = Math.max(18, Math.min(120, parseInt((fontSizeInput && fontSizeInput.value) || '36', 10) || 36));
    const prefix = (prefixInput && prefixInput.value !== undefined) ? String(prefixInput.value) : 'Промо код: ';

    btn.disabled = true;
    setFlyerProgress(t('flyerGenerating', 'Generating flyers…'), true);

    try {
        const baseImg = await loadImageFromFile(file);
        const w = baseImg.naturalWidth || baseImg.width;
        const h = baseImg.naturalHeight || baseImg.height;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');

        const zip = new window.JSZip();
        const idsToMark = [];

        const padding = 20;
        const boxHeight = fontSize + padding * 2;
        const boxY = Math.max(0, h - 40 - boxHeight);

        for (let i = 0; i < eligible.length; i++) {
            const pc = eligible[i];
            const code = (pc && pc.code) ? String(pc.code) : '';
            if (!code) continue;

            setFlyerProgress(`${t('flyerGenerating', 'Generating flyers…')} (${i + 1}/${eligible.length})`, true);

            // Base image
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.filter = 'none';
            ctx.globalAlpha = 1;
            ctx.drawImage(baseImg, 0, 0, w, h);

            // Blur strip (clip + redraw with blur)
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, boxY, w, boxHeight);
            ctx.clip();
            ctx.filter = 'blur(8px)';
            ctx.drawImage(baseImg, 0, 0, w, h);
            ctx.restore();

            // Red translucent bar
            ctx.filter = 'none';
            ctx.fillStyle = 'rgba(200, 0, 0, 0.68)';
            ctx.fillRect(0, boxY, w, boxHeight);

            // Text
            const text = `${prefix}${code}`;
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            ctx.textBaseline = 'alphabetic';
            const metrics = ctx.measureText(text);
            const textWidth = metrics.width || 0;
            const x = Math.max(0, Math.floor((w - textWidth) / 2));
            const y = Math.floor(boxY + padding + fontSize);
            ctx.fillText(text, x, y);

            const blob = await canvasToJpegBlob(canvas, 0.88);
            zip.file(`flyer_${i + 1}.jpg`, blob);
            idsToMark.push(pc.id);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, `flyers_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.zip`);
        setFlyerProgress(t('flyerGeneratedZip', 'Flyers ZIP generated.'), true);

        // Mark as printed on server
        try {
            await markPromoCodesFlyerPrinted(idsToMark);
            await loadPromoCodes();
        } catch (e) {
            console.error('Failed to mark printed:', e);
            alert(t('flyerMarkPrintedFailed', 'Flyers downloaded, but failed to mark as printed. Please refresh and try again.'));
        }
    } finally {
        btn.disabled = false;
        setTimeout(() => setFlyerProgress('', false), 2500);
    }
}

function initPromoFlyersUI() {
    const btn = document.getElementById('generate-flyers-btn');
    const refreshBtn = document.getElementById('refresh-flyers-stats-btn');
    if (btn && !btn.dataset.bound) {
        btn.dataset.bound = '1';
        btn.addEventListener('click', () => {
            generatePromoFlyersZip().catch(err => {
                console.error(err);
                setFlyerProgress('', false);
                alert(err.message || 'Failed to generate flyers');
            });
        });
    }
    if (refreshBtn && !refreshBtn.dataset.bound) {
        refreshBtn.dataset.bound = '1';
        refreshBtn.addEventListener('click', () => {
            try { updatePromoFlyersStats(); } catch (e) {}
        });
    }
    try { updatePromoFlyersStats(); } catch (e) {}
}

// Save promo code (add or edit)
async function savePromoCode() {
    const code = document.getElementById('promo-code-input').value.trim().toUpperCase();
    const category = document.getElementById('promo-code-category').value;
    const discount = parseFloat(document.getElementById('promo-code-discount').value);
    const isActive = document.getElementById('promo-code-active').value === 'true';
    
    if (!code) {
        alert(t('promoEnterCode', 'Please enter a promo code'));
        return;
    }
    
    if (!discount || discount < 1 || discount > 100) {
        alert(t('promoEnterDiscountRange', 'Please enter a discount between 1 and 100%'));
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
            alert(editingPromoId ? t('promoUpdatedSuccess', 'Promo code updated successfully!') : t('promoAddedSuccess', 'Promo code added successfully!'));
            resetPromoForm();
            loadPromoCodes();
        } else {
            const error = await response.json();
            alert(error.error || t('promoFailedSave', 'Failed to save promo code'));
        }
    } catch (error) {
        console.error('Error saving promo code:', error);
        alert(t('promoErrorSave', 'Error saving promo code'));
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
    
    document.getElementById('promo-submit-text').textContent = t('updatePromoCode', 'Update Promo Code');
    document.getElementById('cancel-promo-btn').style.display = 'inline-flex';
    
    // Scroll to form
    document.querySelector('.admin-section h2').scrollIntoView({ behavior: 'smooth' });
}

// Delete promo code
async function deletePromoCode(id) {
    if (!confirm(t('promoDeleteConfirm', 'Are you sure you want to delete this promo code?'))) {
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
            alert(t('promoDeletedSuccess', 'Promo code deleted successfully!'));
            loadPromoCodes();
        } else {
            alert(t('promoFailedDelete', 'Failed to delete promo code'));
        }
    } catch (error) {
        console.error('Error deleting promo code:', error);
        alert(t('promoErrorDelete', 'Error deleting promo code'));
    }
}

// Reset promo code form
function resetPromoForm() {
    editingPromoId = null;
    document.getElementById('promo-code-input').value = '';
    document.getElementById('promo-code-category').value = 'all';
    document.getElementById('promo-code-discount').value = '';
    document.getElementById('promo-code-active').value = 'true';
    document.getElementById('promo-submit-text').textContent = t('addPromoCode', 'Add Promo Code');
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
let lastPendingOrderIds = new Set();

function getPendingOrdersSorted(list) {
    return (list || [])
        .filter(order => order && (order.status === 'pending' || order.status === 'pending_payment'))
        .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
}

// Load and display orders
async function loadOrders() {
    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/orders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            // Server restarts clear activeTokens (in-memory). Force re-login.
            await ensureAuthOrRedirect();
            return;
        }

        if (response.ok) {
            orders = await response.json();
            renderPendingOrders();
            renderOrdersHistory();
        } else {
            console.error('Error loading orders:', response.status);
        }
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function getOrderStatusLabel(status) {
    const s = (status || '').toString();
    const normalized = s === 'confirmed' ? 'approved' : s;
    if (normalized === 'pending') return (currentLanguage === 'bg' ? 'получена' : 'received');
    if (normalized === 'approved') return (currentLanguage === 'bg' ? 'одобрена' : 'approved');
    if (normalized === 'delivering') return (currentLanguage === 'bg' ? 'в доставка' : 'delivering');
    if (normalized === 'ready_for_pickup') return (currentLanguage === 'bg' ? 'готова' : 'ready');
    if (normalized === 'completed') return (currentLanguage === 'bg' ? 'завършена' : 'done');
    if (normalized === 'cancelled') return (currentLanguage === 'bg' ? 'отказана' : 'cancelled');
    return normalized;
}

function formatOrderDateTime(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    const date = d.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
}

function safeToFixed(n, digits = 2) {
    const x = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(x)) return (0).toFixed(digits);
    return x.toFixed(digits);
}

function getOrdersHistoryFilters() {
    const search = (document.getElementById('orders-history-search')?.value || '').toString().trim().toLowerCase();
    // Order history: keep it simple (approved/cancelled).
    const statusEl = document.getElementById('orders-history-status');
    const statusRaw = (statusEl?.value || '').toString().trim();
    const status = statusRaw;
    const method = (document.getElementById('orders-history-method')?.value || '').toString().trim();
    return { search, status, method };
}

function getFilteredOrdersHistory() {
    const { search, status, method } = getOrdersHistoryFilters();

    const historyStatuses = new Set(['approved', 'cancelled']);

    const fromEl = document.getElementById('approved-orders-from');
    const toEl = document.getElementById('approved-orders-to');
    const fromDate = parseDateInputValue(fromEl?.value);
    const toDate = endOfDay(parseDateInputValue(toEl?.value));

    const filtered = (orders || [])
        .filter(o => orderMatchesSearch(o, search))
        .filter(o => {
            const normalized = (o.status || '').toString() === 'confirmed' ? 'approved' : (o.status || '').toString();
            if (!historyStatuses.has(normalized)) return false;
            if (!status) return true;
            return normalized === status;
        })
        .filter(o => {
            if (!method) return true;
            const m = (o.deliveryMethod || o.deliveryType || '').toString();
            return m === method;
        })
        .filter(o => {
            if (!fromDate && !toDate) return true;
            const ts = o.timestamp || o.createdAt;
            const d = new Date(ts);
            if (Number.isNaN(d.getTime())) return false;
            if (fromDate && d < fromDate) return false;
            if (toDate && d > toDate) return false;
            return true;
        })
        .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));

    return filtered;
}

function parseDateInputValue(value) {
    const v = (value || '').toString().trim();
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

function endOfDay(d) {
    if (!d) return null;
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function orderMatchesSearch(order, search) {
    if (!search) return true;
    const hay = [
        order?.id,
        order?.customerInfo?.name,
        order?.customerInfo?.phone,
        order?.customerInfo?.email
    ].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(search);
}

function getNextActionsForOrder(order) {
    const status = (order?.status || '').toString();
    const normalized = status === 'confirmed' ? 'approved' : status;
    const method = (order?.deliveryMethod || order?.deliveryType || '').toString();

    if (normalized === 'pending') {
        return [
            { status: 'approved', label: 'Approve', kind: 'success', icon: 'fa-check' },
            { status: 'cancelled', label: 'Cancel', kind: 'danger', icon: 'fa-times' }
        ];
    }

    if (normalized === 'approved') {
        if (method === 'delivery') {
            return [
                { status: 'delivering', label: 'Set delivering', kind: 'primary', icon: 'fa-truck' },
                { status: 'completed', label: 'Complete', kind: 'success', icon: 'fa-check-circle' },
                { status: 'cancelled', label: 'Cancel', kind: 'danger', icon: 'fa-times' }
            ];
        }
        return [
            { status: 'ready_for_pickup', label: 'Ready', kind: 'primary', icon: 'fa-box' },
            { status: 'completed', label: 'Complete', kind: 'success', icon: 'fa-check-circle' },
            { status: 'cancelled', label: 'Cancel', kind: 'danger', icon: 'fa-times' }
        ];
    }

    if (normalized === 'delivering') {
        return [
            { status: 'completed', label: 'Complete', kind: 'success', icon: 'fa-check-circle' },
            { status: 'cancelled', label: 'Cancel', kind: 'danger', icon: 'fa-times' }
        ];
    }

    if (normalized === 'ready_for_pickup') {
        return [
            { status: 'completed', label: 'Complete', kind: 'success', icon: 'fa-check-circle' },
            { status: 'cancelled', label: 'Cancel', kind: 'danger', icon: 'fa-times' }
        ];
    }

    return [];
}

function renderOrdersHistory() {
    const container = document.getElementById('orders-history-list');
    const stats = document.getElementById('orders-history-stats');
    if (!container) return;

    const filtered = getFilteredOrdersHistory();

    if (stats) {
        stats.textContent = t('showingOrders', `Showing ${filtered.length} order(s)`).replace('{count}', String(filtered.length));
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; color: #999; text-align: center; background: #fff; border: 1px solid #eee; border-radius: 10px;">
                ${t('noOrdersMatch', 'No orders match the filters.')}
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(order => {
        const created = formatOrderDateTime(order.timestamp || order.createdAt);
        const methodLabel = (order.deliveryMethod || order.deliveryType) === 'delivery' ? t('delivery', 'Delivery') : t('pickup', 'Pickup');
        const statusLabel = getOrderStatusLabel(order.status);
        const statusClass = ((order.status || '').toString() === 'confirmed' ? 'approved' : (order.status || '').toString());
        const totalShown = (order.ownerDiscount && order.ownerDiscount > 0 && order.finalTotal != null) ? order.finalTotal : order.total;
        const actions = getNextActionsForOrder(order);

        const productsChipsHtml = (order.items || []).map(item => {
            const qty = Number(item?.quantity) || 0;
            const name = (item?.name || '').toString();
            const hasNote = Boolean(item?.note);
            const noteTitle = hasNote ? ` title="${t('notes', 'Notes')}: ${(item?.note || '').toString().replace(/\s+/g, ' ').trim()}"` : '';
            return `<span class="oh-item-chip"${noteTitle}>${qty}x ${name}${hasNote ? ' *' : ''}</span>`;
        }).join('');

        const itemsHtml = (order.items || []).map(item => {
            const price = Number(item.promoPrice != null ? item.promoPrice : item.price) || 0;
            const qty = Number(item.quantity) || 0;
            const lineTotal = price * qty;
            return `
                <div class="order-item" style="display:flex; justify-content: space-between; gap:10px; padding: 6px 0; border-bottom: 1px dashed #eee;">
                    <span class="order-item-name" style="flex: 1; min-width:0;">
                        <div>${item.name}</div>
                        ${item.note ? `<div style="margin-top:4px; font-size: 12px; color:#555;"><strong>Бележка:</strong> ${item.note}</div>` : ''}
                    </span>
                    <div class="order-item-details" style="display:flex; gap:10px; white-space:nowrap; align-items: baseline;">
                        <span>x${qty}</span>
                        <span>${safeToFixed(lineTotal)} €</span>
                    </div>
                </div>
            `;
        }).join('');

        const actionsHtml = actions.map(a => `
            <button onclick="updateOrderStatus('${order.id}', '${a.status}')" class="btn btn-${a.kind}" style="padding: 6px 10px;">
                <i class="fas ${a.icon}"></i> ${a.label}
            </button>
        `).join('');

        return `
            <div class="order-card status-${statusClass}" style="margin-bottom: 14px;">
                <div class="orders-history-row-scroll">
                    <div class="orders-history-row-layout">
                        <div class="oh-col oh-meta">
                        <div class="oh-id">#${order.id}</div>
                        <div class="oh-time">${created}</div>
                        <div class="oh-badges">
                            <span class="delivery-badge ${(order.deliveryMethod || order.deliveryType) === 'delivery' ? 'delivery' : 'pickup'}">
                                ${(order.deliveryMethod || order.deliveryType) === 'delivery' ? '<i class="fas fa-truck"></i>' : '<i class="fas fa-shopping-bag"></i>'}
                                ${methodLabel}
                            </span>
                            <span class="order-status ${statusClass}">${statusLabel}</span>
                        </div>
                        <div class="oh-total">${t('total', 'Total')}: <strong>${safeToFixed(totalShown)} €</strong></div>
                        </div>

                        <div class="oh-col oh-customer">
                            <div class="oh-title">${t('customer', 'Customer')}</div>
                            <div class="oh-line"><span class="oh-label">${t('customer', 'Customer')}:</span> ${order.customerInfo?.name || ''}</div>
                            <div class="oh-line"><span class="oh-label">${t('phone', 'Phone')}:</span> ${order.customerInfo?.phone || ''}</div>
                            <div class="oh-line"><span class="oh-label">${t('email', 'Email')}:</span> ${order.customerInfo?.email || ''}</div>
                            ${(order.deliveryMethod || order.deliveryType) === 'delivery' ? `
                                <div class="oh-line"><span class="oh-label">${t('city', 'City')}:</span> ${order.customerInfo?.city || ''}</div>
                                <div class="oh-line"><span class="oh-label">${t('address', 'Address')}:</span> ${order.customerInfo?.address || ''}</div>
                            ` : ''}
                            ${order.customerInfo?.notes ? `<div class="oh-line"><span class="oh-label">${t('notes', 'Notes')}:</span> ${order.customerInfo.notes}</div>` : ''}
                        </div>

                        <div class="oh-col oh-products">
                            <div class="oh-title">${t('products', 'Products')} (${(order.items || []).length || 0})</div>
                            <div class="oh-products-chips">
                                ${productsChipsHtml || `<span class="oh-empty">${t('products', 'Products')}: 0</span>`}
                            </div>
                            <div class="oh-note-hint">* ${t('notes', 'Notes')}</div>
                        </div>

                        <div class="oh-col oh-actions">
                            <div class="oh-title">${t('actions', 'Actions')}</div>
                            <div class="oh-actions-buttons">
                                <button onclick="openOrderEditModal('${order.id}')" class="btn btn-secondary" style="padding: 6px 10px;">
                                    <i class="fas fa-pen"></i> ${t('edit', 'Edit')}
                                </button>
                                ${actionsHtml}
                                <button onclick="deleteOrder('${order.id}')" class="btn btn-secondary" style="padding: 6px 10px;">
                                    <i class="fas fa-trash"></i> ${t('delete', 'Delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="orders-history-card-layout">
                    <div class="order-header">
                        <div>
                            <div class="order-id">#${order.id}</div>
                            <div class="order-time">${created}</div>
                        </div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <span class="delivery-badge ${(order.deliveryMethod || order.deliveryType) === 'delivery' ? 'delivery' : 'pickup'}">
                                ${(order.deliveryMethod || order.deliveryType) === 'delivery' ? '<i class="fas fa-truck"></i>' : '<i class="fas fa-shopping-bag"></i>'}
                                ${methodLabel}
                            </span>
                            <span class="order-status ${statusClass}">${statusLabel}</span>
                        </div>
                    </div>

                    <div class="order-body">
                        <div class="order-section" style="margin-bottom: 10px;">
                            <div class="order-info-row"><span class="order-info-label">${t('customer', 'Customer')}:</span><span class="order-info-value">${order.customerInfo?.name || ''}</span></div>
                            <div class="order-info-row"><span class="order-info-label">${t('phone', 'Phone')}:</span><span class="order-info-value">${order.customerInfo?.phone || ''}</span></div>
                            <div class="order-info-row"><span class="order-info-label">${t('email', 'Email')}:</span><span class="order-info-value">${order.customerInfo?.email || ''}</span></div>
                            ${(order.deliveryMethod || order.deliveryType) === 'delivery' ? `
                                <div class="order-info-row"><span class="order-info-label">${t('city', 'City')}:</span><span class="order-info-value">${order.customerInfo?.city || ''}</span></div>
                                <div class="order-info-row"><span class="order-info-label">${t('address', 'Address')}:</span><span class="order-info-value">${order.customerInfo?.address || ''}</span></div>
                            ` : ''}
                            ${order.customerInfo?.notes ? `<div class="order-info-row"><span class="order-info-label">${t('notes', 'Notes')}:</span><span class="order-info-value">${order.customerInfo.notes}</span></div>` : ''}
                        </div>

                        <div class="order-section" style="margin-bottom: 10px;">
                            <details ${((order.items || []).some(i => i?.note) ? 'open' : '')} style="border: none;">
                                <summary style="cursor:pointer; font-weight: 700; color:#333; list-style:none;">
                                    ${t('products', 'Products')} (${(order.items || []).length || 0})
                                </summary>
                                <div class="order-items" style="margin-top: 8px;">
                                    ${itemsHtml || '<div style="color:#999;">No items</div>'}
                                </div>
                            </details>
                        </div>

                        <div class="order-section">
                            <div class="order-total" style="margin-top: 0;">
                                <span class="order-total-label">${t('total', 'Total')}:</span>
                                <span class="order-total-value">${safeToFixed(totalShown)} €</span>
                            </div>
                        </div>
                    </div>

                    <div class="order-actions">
                        <div style="display:flex; gap: 10px; align-items:center; flex-wrap: wrap;">
                            <button onclick="openOrderEditModal('${order.id}')" class="btn btn-secondary" style="padding: 6px 10px;">
                                <i class="fas fa-pen"></i> ${t('edit', 'Edit')}
                            </button>
                            ${actionsHtml}
                            <button onclick="deleteOrder('${order.id}')" class="btn btn-secondary" style="padding: 6px 10px;">
                                <i class="fas fa-trash"></i> ${t('delete', 'Delete')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function escapeCsvValue(value, delimiter = ';') {
    const s = (value === undefined || value === null) ? '' : String(value);
    const needsQuotes = s.includes('"') || s.includes('\n') || s.includes('\r') || s.includes(delimiter);
    const escaped = s.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
}

function pad2(n) {
    const x = Number(n);
    return (x < 10 ? '0' : '') + String(x);
}

function formatNapDateTime(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    // yyyy-mm-dd HH:MM:SS (close to PHP date('Y-m-d H:i:s'))
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatNapRecDateTimeFromScheduledTime(order) {
    const scheduled = (order?.scheduledTime || '').toString().trim();
    if (!scheduled) return { rec_date: '', rec_time: '' };
    const d = new Date(scheduled);
    if (Number.isNaN(d.getTime())) {
        // If it's not parseable, keep it in rec_time as raw string
        return { rec_date: '', rec_time: scheduled };
    }
    const rec_date = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    const rec_time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return { rec_date, rec_time };
}

// ==================== NAP-STYLE EXPORT (matches export_nap.php) ====================
// Fixed exchange rate: 1 EUR = 1.95583 BGN
const NAP_EUR_TO_BGN_RATE = 1.95583;

function napExcelText(value) {
    const s = (value || '').toString();
    // Force Excel to treat the cell as text when opening CSV.
    // Using formula syntax avoids the leading apostrophe showing up.
    return s ? `="${s.replace(/"/g, '""')}"` : '';
}

function napGetShopSettingsForExport() {
    const shop_name = (document.getElementById('restaurant-name-input')?.value || '').toString().trim();
    const address_full = (document.getElementById('site-footer-address')?.value || '').toString().trim();
    const phone_display = (document.getElementById('site-footer-phone')?.value || '').toString().trim();
    const order_email = (
        (document.getElementById('restaurant-notification-email-input')?.value || '').toString().trim() ||
        (document.getElementById('site-footer-email')?.value || '').toString().trim()
    );
    const company_id = '';

    return { shop_name, address_full, phone_display, order_email, company_id };
}

function napGetDefaultFromTo() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = pad2(now.getMonth() + 1);
    const firstDay = `${yyyy}-${mm}-01`;
    const today = `${yyyy}-${mm}-${pad2(now.getDate())}`;
    return { from: firstDay, to: today };
}

function napBgMonthName(mm) {
    const months = {
        '01': 'януари', '02': 'февруари', '03': 'март',
        '04': 'април', '05': 'май', '06': 'юни',
        '07': 'юли', '08': 'август', '09': 'септември',
        '10': 'октомври', '11': 'ноември', '12': 'декември'
    };
    return months[String(mm)] || String(mm);
}

function napFormatDateBG(dateStr) {
    const s = (dateStr || '').toString().trim();
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
    if (!m) return s;
    const yyyy = m[1];
    const mm = m[2];
    const dd = m[3];
    return `${dd} ${napBgMonthName(mm)} ${yyyy}`;
}

function napFormatTableDateTime(ts) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function napGetPayMethod(order) {
    const method = (order?.payment?.method || '').toString().trim().toLowerCase();
    return method === 'card' ? 'bank' : 'cash';
}

function napIsPaid(order) {
    const payMethod = napGetPayMethod(order);
    if (payMethod === 'bank') {
        return (order?.payment?.status || '').toString().trim().toLowerCase() === 'paid';
    }
    // Cash orders are considered paid when completed.
    const st = (order?.status || '').toString();
    const normalized = st === 'confirmed' ? 'approved' : st;
    return normalized === 'completed';
}

function napCalcEurTotals(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    let subtotalCents = 0;
    for (const it of items) {
        const qty = Math.max(0, Math.floor(Number(it?.quantity) || 0));
        if (!qty) continue;
        const unitEUR = Math.max(0, Number(it?.price) || 0);
        const unitCents = Math.round(unitEUR * 100);
        subtotalCents += unitCents * qty;
    }

    const subtotalEUR = subtotalCents / 100;

    // Discount in this app is percent; compute from subtotal.
    const discountPct = Math.max(0, Math.min(100, Number(order?.discount) || 0));
    const discountEUR = Math.round((subtotalEUR * (discountPct / 100)) * 100) / 100;

    const deliveryEUR = Math.round((Number(order?.deliveryFee) || 0) * 100) / 100;

    let grandEUR = subtotalEUR - discountEUR + deliveryEUR;
    if (grandEUR < 0) grandEUR = 0;

    // If BORICA stores a EUR amount for card payments, treat it as truth.
    const payMethod = napGetPayMethod(order);
    const borCurr = (order?.payment?.currency || '').toString().trim().toUpperCase();
    const borAmt = Number(order?.payment?.amount);
    if (payMethod === 'bank' && borCurr === 'EUR' && Number.isFinite(borAmt) && borAmt > 0) {
        grandEUR = Math.round(borAmt * 100) / 100;
    } else {
        grandEUR = Math.round(grandEUR * 100) / 100;
    }

    return {
        subtotal_eur: Math.round(subtotalEUR * 100) / 100,
        discount_eur: Math.round(discountEUR * 100) / 100,
        delivery_eur: Math.round(deliveryEUR * 100) / 100,
        grand_eur: grandEUR
    };
}

function napCalcAmounts(order) {
    const eur = napCalcEurTotals(order);
    const payMethod = napGetPayMethod(order);
    const borCurr = (order?.payment?.currency || '').toString().trim().toUpperCase();
    const borAmt = Number(order?.payment?.amount);

    let grand_bgn = eur.grand_eur * NAP_EUR_TO_BGN_RATE;
    if (payMethod === 'bank' && borCurr === 'BGN' && Number.isFinite(borAmt) && borAmt > 0) {
        grand_bgn = borAmt;
    }

    return {
        grand_eur: eur.grand_eur,
        grand_bgn: Math.round(grand_bgn * 100) / 100
    };
}

function napGetNapDocType(order) {
    const payMethod = napGetPayMethod(order);
    return payMethod === 'bank'
        ? 'КАРТА (онлайн) — Борика'
        : 'НП — Наложен платеж';
}

function napExportTypeLabel(exportType) {
    if (exportType === 'bank_paid') return 'Само платени картови';
    if (exportType === 'bank') return 'Само картови плащания';
    if (exportType === 'cash') return 'Само кеш плащания';
    return 'Всички плащания';
}

function napPromptExportParams() {
    const storedType = (localStorage.getItem('napExportType') || 'all').toString();
    const storedCurrency = (localStorage.getItem('napExportCurrency') || 'bgn').toString();
    const storedOnlyPaid = (localStorage.getItem('napExportOnlyPaid') || '1').toString();

    const type = (prompt(
        'NAP export type: all | bank | bank_paid | cash',
        storedType
    ) || '').toString().trim().toLowerCase();
    if (!type) return null;
    if (!['all', 'bank', 'bank_paid', 'cash'].includes(type)) {
        alert('Invalid export type. Use: all, bank, bank_paid, cash');
        return null;
    }

    const currency = (prompt('Currency: bgn | eur', storedCurrency) || '').toString().trim().toLowerCase();
    if (!currency) return null;
    if (!['bgn', 'eur'].includes(currency)) {
        alert('Invalid currency. Use: bgn or eur');
        return null;
    }

    const onlyPaidDefault = storedOnlyPaid === '1';
    const onlyPaid = confirm(`Only paid? (OK = yes, Cancel = no)\nCurrent: ${onlyPaidDefault ? 'YES' : 'NO'}`) ? true : false;

    localStorage.setItem('napExportType', type);
    localStorage.setItem('napExportCurrency', currency);
    localStorage.setItem('napExportOnlyPaid', onlyPaid ? '1' : '0');

    return { exportType: type, currency, onlyPaid };
}

function napFilterOrder(order, exportType, onlyPaid) {
    const payMethod = napGetPayMethod(order);
    const paid = napIsPaid(order);

    if (exportType === 'bank') {
        if (payMethod !== 'bank') return false;
        if (onlyPaid && !paid) return false;
        return true;
    }
    if (exportType === 'bank_paid') {
        if (payMethod !== 'bank') return false;
        return paid;
    }
    if (exportType === 'cash') {
        return payMethod === 'cash';
    }

    // all
    if (onlyPaid && payMethod === 'bank' && !paid) return false;
    return true;
}

function parseBoolLike(v) {
    const s = (v ?? '').toString().trim().toLowerCase();
    if (!s) return false;
    return ['1', 'true', 'yes', 'y', 'да', 'ok', 'available', 'in_stock'].includes(s);
}

function computeOrderTotalsForExport(order) {
    const items = Array.isArray(order?.items) ? order.items : [];

    const products_original = items.reduce((sum, it) => {
        const qty = Number(it?.quantity) || 0;
        const unit = Number(it?.price) || 0;
        return sum + (qty * unit);
    }, 0);

    const products_after_individual_promo = items.reduce((sum, it) => {
        const qty = Number(it?.quantity) || 0;
        const unit = Number(it?.promoPrice != null ? it.promoPrice : it?.price) || 0;
        return sum + (qty * unit);
    }, 0);

    const discountPct = Number(order?.discount) || 0;
    const discount_total = Math.max(0, products_after_individual_promo * (Math.max(0, Math.min(100, discountPct)) / 100));

    const total_products = Math.max(0, products_after_individual_promo - discount_total);
    const shipping_fee = Number(order?.deliveryFee) || 0;
    const grand_total = total_products + shipping_fee;

    return {
        products_original,
        products_after_individual_promo,
        discount_total,
        total_products,
        shipping_fee,
        grand_total
    };
}

function buildNapExportRow(order) {
    const created_at = formatNapDateTime(order.timestamp || order.createdAt);

    const ship_method = (order?.deliveryMethod || order?.deliveryType) === 'delivery' ? 'plovdiv_address' : 'pickup';
    const delivery_text = ship_method === 'pickup' ? 'Взимане от място' : 'Доставка до адрес';

    const paymentMethod = (order?.payment?.method || 'cash').toString().trim().toLowerCase();
    const pay_method = paymentMethod === 'card' ? 'bank' : 'cash';
    const payment_text = pay_method === 'bank' ? 'Плащане онлайн с карта' : 'Наложен платеж';
    const payment_method_human = pay_method === 'bank' ? 'card_online' : 'cash_on_delivery';
    const payment_status = pay_method === 'bank'
        ? ((order?.status === 'pending_payment') ? 'PENDING' : 'PAID')
        : ((order?.status === 'completed') ? 'PAID' : 'DUE_ON_DELIVERY');
    const nap_doc_type = pay_method === 'bank' ? 'КАРТА (онлайн) — Борика' : 'НП — Наложен платеж';

    const { rec_date, rec_time } = formatNapRecDateTimeFromScheduledTime(order);
    const totals = computeOrderTotalsForExport(order);

    const cust_name = (order?.customerInfo?.name || '').toString().trim();
    const cust_phone = (order?.customerInfo?.phone || '').toString().trim();
    const cust_email = (order?.customerInfo?.email || '').toString().trim();

    const rec_name = cust_name;
    const rec_phone = cust_phone;
    const rec_address = (order?.customerInfo?.address || '').toString().trim();

    const order_note = (order?.customerInfo?.notes || '').toString();
    const promo_code = (order?.promoCode || '').toString().trim();
    const discount_info = promo_code ? `${promo_code} (-${Number(order?.discount) || 0}%)` : '';

    const borica_order6 = (order?.payment?.order6 || order?.payment?.providerOrderId || '').toString();
    const cart_payload_json = JSON.stringify({
        id: order?.id,
        items: Array.isArray(order?.items) ? order.items : [],
        promoCode: order?.promoCode,
        discount: order?.discount,
        deliveryMethod: order?.deliveryMethod,
        deliveryFee: order?.deliveryFee,
        total: order?.total,
        createdAt: order?.createdAt,
        scheduledTime: order?.scheduledTime,
        customerInfo: order?.customerInfo
    });

    return {
        id: (order?.id || '').toString(),
        created_at,
        cust_name,
        cust_phone,
        cust_email,
        ship_method,
        delivery_text,
        rec_name,
        rec_phone,
        rec_address,
        rec_date,
        rec_time,
        pay_method,
        payment_text,
        payment_method_human,
        payment_status,
        nap_doc_type,
        total_products: safeToFixed(totals.total_products),
        shipping_fee: safeToFixed(totals.shipping_fee),
        grand_total: safeToFixed(totals.grand_total),
        order_note,
        promo_code,
        discount_info,
        discount_total: safeToFixed(totals.discount_total),
        products_original: safeToFixed(totals.products_original),
        products_after_individual_promo: safeToFixed(totals.products_after_individual_promo),
        borica_order6,
        notify_sent: '',
        notify_sent_at: '',
        cart_payload_json,
        shop_name: (order?.restaurantName || '').toString()
    };
}

function exportOrdersHistoryPdf() {
    const base = getFilteredOrdersHistory();
    if (!base || base.length === 0) {
        alert(t('noOrdersMatch', 'No orders match the filters.'));
        return;
    }

    const params = napPromptExportParams();
    if (!params) return;

    const { exportType, onlyPaid, currency } = params;
    const settings = napGetShopSettingsForExport();

    const fromRaw = (document.getElementById('approved-orders-from')?.value || '').toString().trim();
    const toRaw = (document.getElementById('approved-orders-to')?.value || '').toString().trim();
    const defaults = napGetDefaultFromTo();
    const from = fromRaw || defaults.from;
    const to = toRaw || defaults.to;

    const filtered = base
        .filter(o => napFilterOrder(o, exportType, onlyPaid));

    if (filtered.length === 0) {
        alert(t('noOrdersMatch', 'No orders match the filters.'));
        return;
    }

    const showInEuro = currency === 'eur';
    let totalAmountBgn = 0;
    let totalAmountEur = 0;
    let bankOrders = 0;
    let cashOrders = 0;
    let paidOrders = 0;
    let pendingOrders = 0;

    const rows = filtered.map((o, idx) => {
        const payMethod = napGetPayMethod(o);
        const paid = napIsPaid(o);
        const amounts = napCalcAmounts(o);

        if (payMethod === 'bank') bankOrders++;
        if (payMethod === 'cash') cashOrders++;
        if (paid) paidOrders++; else pendingOrders++;

        totalAmountBgn += amounts.grand_bgn;
        totalAmountEur += amounts.grand_eur;

        const amountText = showInEuro
            ? `${safeToFixed(amounts.grand_eur)} €`
            : `${safeToFixed(amounts.grand_bgn)} лв.`;

        return {
            n: idx + 1,
            created_at: napFormatTableDateTime(o.timestamp || o.createdAt),
            id: (o?.id || '').toString(),
            cust_name: (o?.customerInfo?.name || '').toString(),
            cust_phone: (o?.customerInfo?.phone || '').toString(),
            pay_label: payMethod === 'bank' ? 'КАРТА' : 'КЕШ',
            status_label: paid ? 'ПЛАТЕНО' : 'ЧАКА',
            nap_doc_type: napGetNapDocType(o),
            amount_text: amountText
        };
    });

    totalAmountBgn = Math.round(totalAmountBgn * 100) / 100;
    totalAmountEur = Math.round(totalAmountEur * 100) / 100;

    const exportTypeLabel = napExportTypeLabel(exportType);
    const currencyLabel = showInEuro ? 'Евро (€)' : 'Български лева (BGN)';
    const onlyPaidLabel = (exportType === 'bank_paid') ? 'Само PAID' : (onlyPaid ? 'Да' : 'Не');
    const totalAmountText = showInEuro
        ? `${safeToFixed(totalAmountEur)} €`
        : `${safeToFixed(totalAmountBgn)} лв.`;

    const avgText = rows.length
        ? (showInEuro
            ? `${safeToFixed(totalAmountEur / rows.length)} €`
            : `${safeToFixed(totalAmountBgn / rows.length)} лв.`)
        : (showInEuro ? '0.00 €' : '0.00 лв.');

    const ITEMS_PER_PAGE = 25;
    const totalPages = Math.max(1, Math.ceil(rows.length / ITEMS_PER_PAGE));

    const style = `
        @media print {
            @page { size: A4 landscape; margin: 0.5cm; }
            body { margin: 0; padding: 0; font-size: 10pt; }
            .no-print { display: none !important; }
            .page-break { page-break-after: always; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; line-height: 1.3; margin: 20px; background: #fff; }
        .print-controls { background: #f8f9fa; padding: 15px; margin-bottom: 20px; border: 2px solid #dc2626; border-radius: 10px; text-align: center; }
        .print-btn { background: #dc2626; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-size: 16px; cursor: pointer; margin: 0 10px; }
        .print-btn:hover { background: #b91c1c; }
        .container { width: 100%; max-width: 29.7cm; margin: 0 auto; }
        .header-section { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #dc2626; }
        .header-title { color: #dc2626; font-size: 22pt; margin-bottom: 8px; font-weight: bold; text-transform: uppercase; }
        .header-subtitle { color: #666; font-size: 14pt; }
        .company-info { margin-bottom: 15px; padding: 12px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #3b82f6; font-size: 10pt; }
        .company-info p { margin: 4px 0; }
        .report-period { margin-bottom: 18px; padding: 12px; background: #f0f9ff; border-radius: 5px; border: 2px solid #93c5fd; font-size: 10pt; }
        .report-period h3 { color: #1e40af; margin-bottom: 8px; font-size: 12pt; font-weight: bold; }
        .period-details { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .period-label { font-weight: bold; color: #475569; }
        .period-value { color: #1e293b; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
        .stat-box { padding: 12px 10px; border-radius: 5px; text-align: center; border: 2px solid; }
        .stat-total { background: #dbeafe; border-color: #3b82f6; }
        .stat-bank { background: #dcfce7; border-color: #10b981; }
        .stat-cash { background: #fef3c7; border-color: #f59e0b; }
        .stat-amount { background: #fce7f3; border-color: #db2777; }
        .stat-number { font-size: 16pt; font-weight: bold; margin-bottom: 4px; color: #1e293b; }
        .stat-label { font-size: 9pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
        .orders-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9.5pt; }
        .table-header { background: #f3f4f6; border: 2px solid #d1d5db; }
        .table-header th { padding: 8px 6px; text-align: left; font-weight: bold; color: #374151; border: 1px solid #d1d5db; }
        .table-row td { padding: 6px 5px; border: 1px solid #d1d5db; vertical-align: top; }
        .table-row:nth-child(even) { background: #f9fafb; }
        .order-id { font-family: "Courier New", monospace; font-weight: bold; color: #1e40af; }
        .badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 8.5pt; font-weight: bold; text-align: center; min-width: 50px; }
        .badge-paid { background: #d1fae5; color: #065f46; border: 1px solid #10b981; }
        .badge-pending { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; }
        .badge-cash { background: #e0e7ff; color: #3730a3; border: 1px solid #4f46e5; }
        .badge-bank { background: #dbeafe; color: #1e40af; border: 1px solid #3b82f6; }
        .amount-cell { text-align: right; font-weight: bold; color: #1e293b; }
        .summary-section { margin-top: 20px; padding: 15px; background: #f8fafc; border-radius: 5px; border: 2px solid #cbd5e1; }
        .summary-title { font-size: 12pt; font-weight: bold; color: #1e293b; margin-bottom: 10px; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .summary-item { padding: 6px 0; border-bottom: 1px dashed #cbd5e1; }
        .summary-label { font-weight: bold; color: #475569; }
        .summary-value { color: #1e293b; text-align: right; }
        .total-row { font-size: 12pt; font-weight: bold; color: #dc2626; padding-top: 8px; border-top: 3px solid #dc2626; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 2px solid #d1d5db; text-align: center; color: #6b7280; font-size: 9pt; }
        .no-data { text-align: center; padding: 30px; background: #fef2f2; border-radius: 5px; border: 2px solid #fecaca; }
        .no-data h3 { color: #dc2626; margin-bottom: 10px; font-size: 14pt; }
    `;

    const headerHtml = `
        <div class="header-section">
            <div class="header-title">ОТЧЕТ ЗА НАП</div>
            <div class="header-subtitle">${escapeHtml(settings.shop_name || '')}</div>
        </div>

        <div class="company-info">
            <p><strong>Адрес:</strong> ${escapeHtml(settings.address_full || '')}</p>
            <p><strong>Телефон:</strong> ${escapeHtml(settings.phone_display || '')}</p>
            <p><strong>Имейл:</strong> ${escapeHtml(settings.order_email || '')}</p>
            <p><strong>ЕИК/БУЛСТАТ:</strong> ${escapeHtml(settings.company_id || '')}</p>
        </div>

        <div class="report-period">
            <h3>ПАРАМЕТРИ НА ОТЧЕТА</h3>
            <div class="period-details">
                <div class="period-item"><span class="period-label">Период:</span> <span class="period-value">${escapeHtml(napFormatDateBG(from))} - ${escapeHtml(napFormatDateBG(to))}</span></div>
                <div class="period-item"><span class="period-label">Тип плащане:</span> <span class="period-value">${escapeHtml(exportTypeLabel)}</span></div>
                <div class="period-item"><span class="period-label">Валута:</span> <span class="period-value">${escapeHtml(currencyLabel)}</span></div>
                <div class="period-item"><span class="period-label">Филтър платени:</span> <span class="period-value">${escapeHtml(onlyPaidLabel)}</span></div>
                <div class="period-item"><span class="period-label">Дата на генериране:</span> <span class="period-value">${escapeHtml(new Date().toLocaleString('bg-BG'))}</span></div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-box stat-total"><div class="stat-number">${rows.length}</div><div class="stat-label">Общо поръчки</div></div>
            <div class="stat-box stat-bank"><div class="stat-number">${bankOrders}</div><div class="stat-label">Картови</div></div>
            <div class="stat-box stat-cash"><div class="stat-number">${cashOrders}</div><div class="stat-label">Кеш</div></div>
            <div class="stat-box stat-amount"><div class="stat-number">${escapeHtml(totalAmountText)}</div><div class="stat-label">Обща сума</div></div>
        </div>
    `;

    const tableHeader = `
        <thead class="table-header">
            <tr>
                <th width="4%">№</th>
                <th width="12%">Дата и час</th>
                <th width="13%">ID поръчка</th>
                <th width="18%">Клиент</th>
                <th width="12%">Телефон</th>
                <th width="10%">Плащане</th>
                <th width="10%">Статус</th>
                <th width="11%">НАП документ</th>
                <th width="10%">Сума ${showInEuro ? '(€)' : '(лв.)'}</th>
            </tr>
        </thead>
    `;

    const pagesHtml = Array.from({ length: totalPages }).map((_, pageIdx) => {
        const start = pageIdx * ITEMS_PER_PAGE;
        const pageRows = rows.slice(start, start + ITEMS_PER_PAGE);
        const counterStart = start + 1;
        const tableRowsHtml = pageRows.map((r, i) => {
            const paymentBadge = r.pay_label === 'КАРТА'
                ? '<span class="badge badge-bank">КАРТА</span>'
                : '<span class="badge badge-cash">КЕШ</span>';
            const statusBadge = r.status_label === 'ПЛАТЕНО'
                ? '<span class="badge badge-paid">ПЛАТЕНО</span>'
                : '<span class="badge badge-pending">ЧАКА</span>';
            return `
                <tr class="table-row">
                    <td>${counterStart + i}</td>
                    <td>${escapeHtml(r.created_at)}</td>
                    <td><span class="order-id">${escapeHtml(r.id)}</span></td>
                    <td>${escapeHtml(r.cust_name)}</td>
                    <td>${escapeHtml(r.cust_phone)}</td>
                    <td>${paymentBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${escapeHtml(r.nap_doc_type)}</td>
                    <td class="amount-cell">${escapeHtml(r.amount_text)}</td>
                </tr>
            `;
        }).join('');

        return `
            ${pageIdx > 0 ? '<div class="page-break"></div>' : ''}
            <h3 style="font-size: 12pt; font-weight: bold; margin-bottom: 10px; color: #1e293b;">ДЕТАЙЛЕН СПИСЪК НА ПОРЪЧКИТЕ - Страница ${pageIdx + 1} от ${totalPages}</h3>
            <table class="orders-table">${tableHeader}<tbody>${tableRowsHtml}</tbody></table>
        `;
    }).join('');

    const summaryHtml = `
        <div class="summary-section">
            <div class="summary-title">ОБОБЩЕНИЕ НА ОТЧЕТА</div>
            <div class="summary-grid">
                <div class="summary-item"><span class="summary-label">Общ брой поръчки:</span> <span class="summary-value">${rows.length} бр.</span></div>
                <div class="summary-item"><span class="summary-label">Картови:</span> <span class="summary-value">${bankOrders} бр.</span></div>
                <div class="summary-item"><span class="summary-label">Кеш:</span> <span class="summary-value">${cashOrders} бр.</span></div>
                <div class="summary-item"><span class="summary-label">Платени (PAID):</span> <span class="summary-value">${paidOrders} бр.</span></div>
                <div class="summary-item"><span class="summary-label">Други статуси:</span> <span class="summary-value">${pendingOrders} бр.</span></div>
                <div class="summary-item"><span class="summary-label">Средна поръчка:</span> <span class="summary-value">${escapeHtml(avgText)}</span></div>
                <div class="summary-item total-row"><span class="summary-label">ОБЩА СУМА:</span> <span class="summary-value">${escapeHtml(totalAmountText)}</span></div>
            </div>
        </div>
    `;

    const html = `
<!DOCTYPE html>
<html lang="bg">
<head>
    <meta charset="UTF-8">
    <title>Отчет за НАП - ${escapeHtml(settings.shop_name || 'shop')}</title>
    <style>${style}</style>
</head>
<body>
    <div class="print-controls no-print">
        <button class="print-btn" onclick="window.print()">Принтирай / Запази като PDF</button>
        <button class="print-btn" onclick="window.close()">Затвори</button>
        <p style="margin-top: 10px; color: #666; font-size: 12pt;"><strong>Инструкции:</strong> Натисни "Принтирай", избери "Запази като PDF".</p>
    </div>

    <div class="container">
        ${headerHtml}
        ${pagesHtml}
        ${summaryHtml}
        <div class="footer">
            <p>Този отчет е генериран автоматично от системата на <strong>${escapeHtml(settings.shop_name || '')}</strong></p>
            <p>Валута: ${escapeHtml(currencyLabel)} | Дата: ${escapeHtml(new Date().toLocaleString('bg-BG'))}</p>
        </div>
    </div>
</body>
</html>`;

    const w = window.open('', '_blank');
    if (!w) {
        alert('Popup blocked. Please allow popups to export PDF.');
        return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
}

function exportOrdersHistoryCsv() {
    const base = getFilteredOrdersHistory();
    if (!base || base.length === 0) {
        alert(t('noOrdersMatch', 'No orders match the filters.'));
        return;
    }

    const params = napPromptExportParams();
    if (!params) return;

    const { exportType, onlyPaid, currency } = params;
    const showInEuro = currency === 'eur';
    const settings = napGetShopSettingsForExport();

    const filtered = base.filter(o => napFilterOrder(o, exportType, onlyPaid));
    if (!filtered || filtered.length === 0) {
        alert(t('noOrdersMatch', 'No orders match the filters.'));
        return;
    }

    const headers = ['№', 'Дата и час', 'ID поръчка', 'Клиент', 'Телефон', 'Плащане', 'Статус', 'НАП документ', 'Сума'];
    const delimiter = ';';

    const lines = filtered.map((o, idx) => {
        const payMethod = napGetPayMethod(o);
        const paid = napIsPaid(o);
        const amounts = napCalcAmounts(o);
        const amountText = showInEuro
            ? `${safeToFixed(amounts.grand_eur)} €`
            : `${safeToFixed(amounts.grand_bgn)} лв.`;

        const row = [
            String(idx + 1),
            napExcelText(napFormatTableDateTime(o.timestamp || o.createdAt)),
            (o?.id || '').toString(),
            (o?.customerInfo?.name || '').toString(),
            (o?.customerInfo?.phone || '').toString(),
            payMethod === 'bank' ? 'КАРТА' : 'КЕШ',
            paid ? 'ПЛАТЕНО' : 'ЧАКА',
            napGetNapDocType(o),
            amountText
        ];
        return row.map(v => escapeCsvValue(v, delimiter)).join(delimiter);
    });

    const shopSafe = (settings.shop_name || 'shop').replace(/[^a-zA-Z0-9]/g, '_');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const currencySuffix = showInEuro ? '_EUR' : '_BGN';
    const filename = `NAP_REPORT_${shopSafe}_${stamp}${currencySuffix}.csv`;

    const csvContent = '\ufeff' + [headers.map(h => escapeCsvValue(h, delimiter)).join(delimiter), ...lines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', () => {
    const search = document.getElementById('orders-history-search');
    const status = document.getElementById('orders-history-status');
    const method = document.getElementById('orders-history-method');
    if (search) {
        let t;
        search.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(renderOrdersHistory, 200);
        });
    }
    if (status) status.addEventListener('change', renderOrdersHistory);
    if (method) method.addEventListener('change', renderOrdersHistory);

    const from = document.getElementById('approved-orders-from');
    const to = document.getElementById('approved-orders-to');
    if (from) from.addEventListener('change', renderOrdersHistory);
    if (to) to.addEventListener('change', renderOrdersHistory);
});

async function printApprovedOrdersRange() {
    try {
        const status = (document.getElementById('orders-history-status')?.value || '').toString().trim();
        if (status && status !== 'approved') {
            alert(t('printApprovedOnly', 'Printing is available only for approved orders.'));
            return;
        }
        const fromEl = document.getElementById('approved-orders-from');
        const toEl = document.getElementById('approved-orders-to');
        const from = (fromEl?.value || '').toString().trim();
        const to = (toEl?.value || '').toString().trim();

        if (!from || !to) {
            alert('Please select From and To dates');
            return;
        }

        const token = sessionStorage.getItem('adminToken');
        const res = await fetch(`${API_URL}/printer/print-approved?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const payload = await res.json().catch(() => ({}));
        if (!res.ok || !payload?.success) {
            alert(payload?.error || 'Failed to print approved orders');
            return;
        }

        alert(`Print started: ${payload.printed || 0} printed, ${payload.failed || 0} failed`);
    } catch (e) {
        console.error('printApprovedOrdersRange failed:', e);
        alert('Failed to print approved orders');
    }
}

// -------------------- Order editing --------------------
let currentEditingOrderId = null;

function openOrderEditModal(orderId) {
    const modal = document.getElementById('order-edit-modal');
    if (!modal) return;

    const order = (orders || []).find(o => o.id === orderId);
    if (!order) {
        alert('Order not found');
        return;
    }

    currentEditingOrderId = orderId;
    const title = document.getElementById('order-edit-title');
    if (title) title.textContent = `#${order.id}`;

    document.getElementById('order-edit-status').value = (order.status === 'confirmed' ? 'approved' : order.status) || 'pending';
    document.getElementById('order-edit-method').value = (order.deliveryMethod || order.deliveryType) || 'delivery';
    document.getElementById('order-edit-delivery-fee').value = (order.deliveryFee != null ? Number(order.deliveryFee) : 0);
    document.getElementById('order-edit-discount').value = (order.discount != null ? Number(order.discount) : 0);

    document.getElementById('order-edit-customer-name').value = order.customerInfo?.name || '';
    document.getElementById('order-edit-customer-phone').value = order.customerInfo?.phone || '';
    document.getElementById('order-edit-customer-email').value = order.customerInfo?.email || '';
    document.getElementById('order-edit-customer-city').value = order.customerInfo?.city || '';
    document.getElementById('order-edit-customer-address').value = order.customerInfo?.address || '';
    document.getElementById('order-edit-customer-notes').value = order.customerInfo?.notes || '';

    const itemsWrap = document.getElementById('order-edit-items');
    if (itemsWrap) {
        itemsWrap.innerHTML = '';
        (order.items || []).forEach(item => orderEditAddItemRow(item));
    }

    orderEditRecomputeTotals();
    modal.style.display = 'block';
}

function closeOrderEditModal() {
    const modal = document.getElementById('order-edit-modal');
    if (modal) modal.style.display = 'none';
    currentEditingOrderId = null;
}

function orderEditAddItemRow(item = null) {
    const wrap = document.getElementById('order-edit-items');
    if (!wrap) return;

    const rowId = `edit-item-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const name = item?.name || '';
    const price = item?.price != null ? Number(item.price) : 0;
    const quantity = item?.quantity != null ? Number(item.quantity) : 1;

    const row = document.createElement('div');
    row.id = rowId;
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '2fr 1fr 1fr auto';
    row.style.gap = '10px';
    row.style.alignItems = 'end';
    row.innerHTML = `
        <div class="form-group" style="margin:0;">
            <label>Name</label>
            <input type="text" class="order-edit-item-name" value="${String(name).replace(/"/g, '&quot;')}" />
        </div>
        <div class="form-group" style="margin:0;">
            <label>Price</label>
            <input type="number" min="0" step="0.01" class="order-edit-item-price" value="${price}" />
        </div>
        <div class="form-group" style="margin:0;">
            <label>Qty</label>
            <input type="number" min="1" step="1" class="order-edit-item-qty" value="${quantity}" />
        </div>
        <button class="btn btn-danger" style="height: 40px;" onclick="orderEditRemoveItemRow('${rowId}')">
            <i class="fas fa-trash"></i>
        </button>
    `;

    row.querySelectorAll('input').forEach(inp => inp.addEventListener('input', orderEditRecomputeTotals));
    wrap.appendChild(row);
}

function orderEditRemoveItemRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) row.remove();
    orderEditRecomputeTotals();
}

function orderEditCollectItems() {
    const wrap = document.getElementById('order-edit-items');
    if (!wrap) return [];
    const rows = Array.from(wrap.children);
    return rows.map(r => {
        const name = (r.querySelector('.order-edit-item-name')?.value || '').toString().trim();
        const price = Number(r.querySelector('.order-edit-item-price')?.value);
        const quantity = Number(r.querySelector('.order-edit-item-qty')?.value);
        return {
            name,
            price: Number.isFinite(price) ? price : 0,
            quantity: Number.isFinite(quantity) ? quantity : 1
        };
    }).filter(i => i.name && i.quantity > 0);
}

function orderEditRecomputeTotals() {
    const items = orderEditCollectItems();
    const deliveryFee = Number(document.getElementById('order-edit-delivery-fee')?.value);
    const discountPercent = Number(document.getElementById('order-edit-discount')?.value);

    const subtotal = items.reduce((sum, i) => sum + (Number(i.price) * Number(i.quantity)), 0);
    const pct = (Number.isFinite(discountPercent) ? discountPercent : 0);
    const discountAmount = subtotal * (Math.max(0, Math.min(100, pct)) / 100);
    const fee = Number.isFinite(deliveryFee) ? deliveryFee : 0;
    const total = Math.max(0, subtotal - discountAmount + fee);

    const box = document.getElementById('order-edit-totals');
    if (box) {
        box.innerHTML = `
            <div style="display:flex; justify-content: space-between;"><span>Subtotal</span><strong>${safeToFixed(subtotal)} €</strong></div>
            <div style="display:flex; justify-content: space-between;"><span>Discount</span><strong>-${safeToFixed(discountAmount)} €</strong></div>
            <div style="display:flex; justify-content: space-between;"><span>Delivery fee</span><strong>${safeToFixed(fee)} €</strong></div>
            <div style="display:flex; justify-content: space-between; margin-top: 6px; border-top: 1px dashed #ddd; padding-top: 6px;"><span>Total</span><strong>${safeToFixed(total)} €</strong></div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    ['order-edit-delivery-fee', 'order-edit-discount', 'order-edit-method', 'order-edit-status'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', orderEditRecomputeTotals);
        if (el) el.addEventListener('change', orderEditRecomputeTotals);
    });
});

async function saveOrderEdits() {
    if (!currentEditingOrderId) return;

    const status = document.getElementById('order-edit-status')?.value;
    const deliveryMethod = document.getElementById('order-edit-method')?.value;
    const deliveryFee = Number(document.getElementById('order-edit-delivery-fee')?.value);
    const discount = Number(document.getElementById('order-edit-discount')?.value);

    const customerInfo = {
        name: (document.getElementById('order-edit-customer-name')?.value || '').toString().trim(),
        phone: (document.getElementById('order-edit-customer-phone')?.value || '').toString().trim(),
        email: (document.getElementById('order-edit-customer-email')?.value || '').toString().trim(),
        city: (document.getElementById('order-edit-customer-city')?.value || '').toString().trim(),
        address: (document.getElementById('order-edit-customer-address')?.value || '').toString().trim(),
        notes: (document.getElementById('order-edit-customer-notes')?.value || '').toString().trim()
    };

    const items = orderEditCollectItems();
    if (items.length === 0) {
        alert('Order must have at least 1 item.');
        return;
    }

    if (!customerInfo.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerInfo.email)) {
        alert('Valid customer email is required.');
        return;
    }

    if (deliveryMethod === 'delivery') {
        if (!customerInfo.city || !customerInfo.address) {
            alert(t('cityAndAddressRequired', 'City and address are required for delivery orders.'));
            return;
        }
    }

    try {
        const token = sessionStorage.getItem('adminToken');
        const response = await fetch(`${API_URL}/orders/${currentEditingOrderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                status,
                deliveryMethod,
                deliveryType: deliveryMethod,
                deliveryFee: Number.isFinite(deliveryFee) ? deliveryFee : 0,
                discount: Number.isFinite(discount) ? discount : 0,
                customerInfo,
                items
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            alert(err.error || 'Failed to update order');
            return;
        }

        closeOrderEditModal();
        await loadOrders();
    } catch (e) {
        console.error('saveOrderEdits failed:', e);
        alert('Failed to update order');
    }
}

// Render pending orders at the top
function renderPendingOrders() {
    const pendingOrders = getPendingOrdersSorted(orders);

    const section = document.getElementById('pending-orders-section');
    const badge = document.getElementById('pending-count-badge');
    const tabBadge = document.getElementById('pending-count-badge-tab');
    const list = document.getElementById('pending-orders-list');

    if (tabBadge) tabBadge.textContent = String(pendingOrders.length || 0);

    if (pendingOrders.length === 0) {
        if (section) section.style.display = 'none';
        if (badge) badge.textContent = '0';
        return;
    }

    if (section) section.style.display = 'block';
    if (badge) badge.textContent = String(pendingOrders.length);

    function formatStatusLabel(status, deliveryMethod) {
        const s = (status || '').toString();
        const normalized = s === 'confirmed' ? 'approved' : s;
        if (normalized === 'pending') return 'received';
        if (normalized === 'pending_payment') return 'received';
        if (normalized === 'approved') return 'approved';
        if (normalized === 'delivering') return 'delivering';
        if (normalized === 'ready_for_pickup') return 'waiting';
        if (normalized === 'completed') return 'done';
        if (normalized === 'cancelled') return 'cancelled';
        return normalized;
    }

    list.innerHTML = pendingOrders.map(order => {
        const orderDate = new Date(order.timestamp || order.createdAt);
        const formattedDate = orderDate.toLocaleDateString('bg-BG', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const formattedTime = orderDate.toLocaleTimeString('bg-BG', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const method = (order.deliveryMethod || order.deliveryType || '').toString();
        const deliveryIcon = method === 'delivery' 
            ? '<i class="fas fa-truck"></i> Доставка' 
            : '<i class="fas fa-shopping-bag"></i> Взимане';

        const statusLabel = formatStatusLabel(order.status, method);
        const isAwaitingPayment = order.status === 'pending_payment';
        const statusClass = isAwaitingPayment ? 'pending' : order.status;
        const paymentBadge = isAwaitingPayment
            ? `<span class="order-status pending_payment">Awaiting payment</span>`
            : '';

        const itemsList = (order.items || []).map(item => `
            <div class="order-item" style="display:flex; justify-content: space-between; gap:10px;">
                <span class="order-item-name" style="flex: 1; min-width:0;">
                    <div>${item.name}</div>
                    ${item.note ? `<div style="margin-top:4px; font-size: 12px; color:#555;"><strong>Бележка:</strong> ${item.note}</div>` : ''}
                </span>
                <div class="order-item-details" style="display:flex; gap:10px; white-space:nowrap;">
                    <span>x${item.quantity}</span>
                    <span>${(item.price * item.quantity).toFixed(2)} €</span>
                </div>
            </div>
        `).join('');

        const summaryLine = `${formattedDate} ${formattedTime} • ${order.customerInfo?.name || ''} • ${(order.total || 0).toFixed(2)} €`;

        return `
            <div class="order-card" style="margin-bottom: 14px;">
                <details style="border: none;" open>
                    <summary style="list-style:none; cursor:pointer;">
                        <div class="order-header">
                            <div>
                                <div class="order-id">Поръчка #${order.id}</div>
                                <div class="order-time">${summaryLine}</div>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content:flex-end;">
                                <span class="delivery-badge ${method}">${deliveryIcon}</span>
                                <span class="order-status ${statusClass}">${statusLabel}</span>
                                ${paymentBadge}
                            </div>
                        </div>
                    </summary>

                    <div class="order-body">
                        <div class="order-section" style="margin-bottom: 10px;">
                            <h4><i class="fas fa-user"></i> Информация за Клиента</h4>
                            <div class="order-info-row"><span class="order-info-label">Име:</span><span class="order-info-value">${order.customerInfo?.name || ''}</span></div>
                            <div class="order-info-row"><span class="order-info-label">Телефон:</span><span class="order-info-value"><a href="tel:${order.customerInfo?.phone || ''}" style="color: #e74c3c; text-decoration: none; font-weight: 600;">${order.customerInfo?.phone || ''}</a></span></div>
                            <div class="order-info-row"><span class="order-info-label">Имейл:</span><span class="order-info-value"><a href="mailto:${order.customerInfo?.email || ''}" style="color: #3498db; text-decoration: none;">${order.customerInfo?.email || ''}</a></span></div>
                            ${method === 'delivery' ? `<div class="order-info-row"><span class="order-info-label">Адрес:</span><span class="order-info-value">${order.customerInfo?.address || ''}</span></div>` : ''}
                            ${order.customerInfo?.notes ? `<div class="order-info-row"><span class="order-info-label">Бележки:</span><span class="order-info-value">${order.customerInfo.notes}</span></div>` : ''}
                        </div>

                        <div class="order-section">
                            <h4><i class="fas fa-shopping-cart"></i> Поръчани Продукти</h4>
                            <div class="order-items">${itemsList}</div>
                            ${order.promoCode ? `<div class="order-info-row" style="margin-top: 10px; color: #27ae60;"><span class="order-info-label">Промо код:</span><span class="order-info-value">${order.promoCode} (-${order.discount}%)</span></div>` : ''}
                            ${(order.deliveryFee && order.deliveryFee > 0) ? `<div class="order-info-row" style="margin-top: 10px;"><span class="order-info-label">Такса доставка:</span><span class="order-info-value">${Number(order.deliveryFee || 0).toFixed(2)} €</span></div>` : ''}
                            ${method === 'delivery' && (!order.deliveryFee || order.deliveryFee === 0) ? `<div class="order-info-row" style="margin-top: 10px; color: #27ae60;"><span class="order-info-label">Безплатна доставка!</span><span class="order-info-value">0.00 €</span></div>` : ''}
                            ${order.ownerDiscount && order.ownerDiscount > 0 ? `<div class="order-info-row" style="margin-top: 10px; color: #e67e22;"><span class="order-info-label">Отстъпка от собственик:</span><span class="order-info-value">-${Number(order.ownerDiscountAmount || 0).toFixed(2)} € (${order.ownerDiscount}%)</span></div>` : ''}
                            <div class="order-total"><span class="order-total-label">Обща Сума:</span><span class="order-total-value">${Number(order.total || 0).toFixed(2)} €</span></div>
                            ${order.ownerDiscount && order.ownerDiscount > 0 ? `<div class="order-total" style="margin-top: 5px; color: #27ae60;"><span class="order-total-label">Финална Сума:</span><span class="order-total-value">${Number(order.finalTotal || 0).toFixed(2)} €</span></div>` : ''}
                        </div>
                    </div>

                    <div class="order-actions">
                        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                            ${order.status === 'pending' ? `
                            <div style="display: flex; gap: 5px; align-items: center;">
                                <label for="discount-${order.id}" style="font-size: 14px; white-space: nowrap;">Отстъпка (%):</label>
                                <input type="number" id="discount-${order.id}" min="0" max="100" step="1" value="0" style="width: 70px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                            </div>
                            <button onclick="updateOrderStatus('${order.id}', 'approved')" class="btn btn-success"><i class="fas fa-check"></i> Одобри Поръчка</button>
                            <button onclick="updateOrderStatus('${order.id}', 'cancelled')" class="btn btn-danger"><i class="fas fa-times"></i> Откажи Поръчка</button>
                            ` : ''}
                            <button onclick="openOrderEditModal('${order.id}')" class="btn btn-secondary"><i class="fas fa-pen"></i> Edit</button>
                            <button onclick="deleteOrder('${order.id}')" class="btn btn-secondary"><i class="fas fa-trash"></i> Изтрий</button>
                        </div>
                    </div>
                </details>
            </div>
        `;
    }).join('');

    // Sound/notifications are handled by polling diff logic (startOrdersPolling)
}

// Update order status
async function updateOrderStatus(orderId, status) {
    // Get the owner discount if confirming
    let ownerDiscount = 0;
    if (status === 'approved') {
        const discountInput = document.getElementById(`discount-${orderId}`);
        ownerDiscount = discountInput ? parseFloat(discountInput.value) || 0 : 0;
        
        if (ownerDiscount < 0 || ownerDiscount > 100) {
            alert('Отстъпката трябва да е между 0% и 100%');
            return;
        }
    }
    
    const confirmMessage = status === 'approved' && ownerDiscount > 0
        ? `Сигурни ли сте, че искате да одобрите тази поръчка с ${ownerDiscount}% отстъпка?`
        : `Сигурни ли сте, че искате да ${status === 'approved' ? 'одобрите' : (status === 'cancelled' ? 'откажете' : 'обновите')} тази поръчка?`;
    
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
            const successMessage = status === 'approved' && ownerDiscount > 0
                ? `Поръчката е одобрена с ${ownerDiscount}% отстъпка успешно!`
                : `Поръчката е обновена успешно!`;
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
            body: `Поръчка #${order.id} от ${order.customerInfo.name}\nОбща сума: ${order.total.toFixed(2)} €`,
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
    if (ordersCheckInterval) return;

    // Load orders immediately
    loadOrders().then(() => {
        const pendingNow = getPendingOrdersSorted(orders);
        lastPendingOrderIds = new Set(pendingNow.map(o => o.id));
    }).catch(() => {});
    
    // Request notification permission
    requestNotificationPermission();

    // Check for new orders frequently so badges update quickly
    ordersCheckInterval = setInterval(async () => {
        const prevPendingIds = new Set(lastPendingOrderIds);
        await loadOrders();

        const pendingNow = getPendingOrdersSorted(orders);
        lastPendingOrderIds = new Set(pendingNow.map(o => o.id));

        const newPendingOrders = pendingNow.filter(o => !prevPendingIds.has(o.id));

        // If there are new pending orders, show notification
        if (newPendingOrders.length > 0) {
            playNotificationSound();
            newPendingOrders.forEach(order => showBrowserNotification(order));
        }
    }, 5000);
}

// Stop orders polling
function stopOrdersPolling() {
    if (ordersCheckInterval) {
        clearInterval(ordersCheckInterval);
        ordersCheckInterval = null;
    }
}

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

            const deliveryHours = settings.deliveryHours || {};
            const deliveryOpening = document.getElementById('delivery-opening-time');
            const deliveryClosing = document.getElementById('delivery-closing-time');
            if (deliveryOpening) deliveryOpening.value = deliveryHours.openingTime || '11:00';
            if (deliveryClosing) deliveryClosing.value = deliveryHours.closingTime || '21:30';
            
            document.getElementById('delivery-enabled').checked = settings.deliveryEnabled !== false;
            document.getElementById('free-delivery-enabled').checked = settings.freeDeliveryEnabled || false;
            document.getElementById('free-delivery-amount').value = settings.freeDeliveryAmount || 50;
            document.getElementById('delivery-fee').value = settings.deliveryFee || 5;
            
            toggleDeliverySection();
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

// Toggle delivery section visibility
async function toggleDeliverySection() {
    const enabled = document.getElementById('delivery-enabled').checked;
    const section = document.getElementById('delivery-settings-section');
    
    if (section) {
        section.style.display = enabled ? 'block' : 'none';
    }
    
    // Auto-save delivery enabled state
    try {
        const currentResponse = await fetch(`${API_URL}/settings/delivery`);
        const currentSettings = await currentResponse.json();
        
        currentSettings.deliveryEnabled = enabled;
        
        const token = sessionStorage.getItem('adminToken');
        await fetch(`${API_URL}/settings/delivery`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(currentSettings)
        });
    } catch (error) {
        console.error('Error saving delivery enabled state:', error);
    }
}

// Toggle pickup availability (auto-save)
async function togglePickupEnabled() {
    const enabled = document.getElementById('pickup-enabled')?.checked !== false;

    try {
        const currentResponse = await fetch(`${API_URL}/settings/order`);
        const currentSettings = await currentResponse.json();

        currentSettings.pickupEnabled = enabled;

        const token = sessionStorage.getItem('adminToken');
        if (!token) {
            alert('Please login first');
            return;
        }

        await fetch(`${API_URL}/settings/order`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(currentSettings)
        });
    } catch (error) {
        console.error('Error saving pickup enabled state:', error);
    }
}

// Save delivery settings
async function saveDeliverySettings() {
    const deliveryEnabled = document.getElementById('delivery-enabled').checked;
    const freeDeliveryEnabled = document.getElementById('free-delivery-enabled').checked;
    const freeDeliveryAmount = parseFloat(document.getElementById('free-delivery-amount').value) || 50;
    const deliveryFee = parseFloat(document.getElementById('delivery-fee').value) || 5;

    const deliveryHours = {
        openingTime: document.getElementById('delivery-opening-time')?.value || '11:00',
        closingTime: document.getElementById('delivery-closing-time')?.value || '21:30'
    };

    try {
        // Get current settings to preserve cityPrices
        const currentResponse = await fetch(`${API_URL}/settings/delivery`);
        const currentSettings = await currentResponse.json();
        
        const settings = {
            deliveryEnabled,
            freeDeliveryEnabled,
            freeDeliveryAmount,
            deliveryFee,
            deliveryHours,
            cityPrices: currentSettings.cityPrices || {}
        };

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
            alert(t('deliverySettingsSaved', 'Delivery settings saved successfully!'));
        } else {
            alert(t('deliverySettingsFailedSave', 'Failed to save delivery settings'));
        }
    } catch (error) {
        console.error('Error saving delivery settings:', error);
        alert(t('deliverySettingsErrorSave', 'Error saving delivery settings'));
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
    select.innerHTML = `<option value="">${t('allCategories', 'All Categories')}</option>` + 
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
        container.innerHTML = `<p style="color: #999; text-align: center;">${t('noProductsFound', 'No products found')}</p>`;
        if (pageInfo) pageInfo.textContent = t('pageInfoEmpty', 'Page 0 of 0');
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
                        <div style="font-size: 13px; color: #4CAF50; font-weight: 600;">${product.price.toFixed(2)} €</div>
                    </div>
                </label>
            `).join('')}
        </div>
    `;
    
    // Update page info
    if (pageInfo) {
        pageInfo.textContent = t('pageInfoProducts', `Page ${comboCurrentPage} of ${totalPages} (${products.length} products)`)
            .replace('{current}', String(comboCurrentPage))
            .replace('{total}', String(totalPages))
            .replace('{count}', String(products.length));
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
        alert(t('comboInvalidNamePrice', 'Please fill in combo name and valid price!'));
        return;
    }
    
    if (selectedComboProducts.size === 0) {
        alert(t('comboSelectAtLeastOne', 'Please select at least one product for this combo!'));
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
            alert(t('comboCreatedSuccess', 'Combo/Bundle created successfully!'));
            clearComboForm();
            loadProductsForCombo();
            loadProducts(); // Refresh main products list
        } else {
            alert(t('comboCreateFailed', 'Failed to create combo/bundle'));
        }
    } catch (error) {
        console.error('Error creating combo:', error);
        alert(t('comboCreateError', 'Error creating combo/bundle'));
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
                    ${t('noCombosTable', 'No combos or bundles yet. Create one above!')}
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
                ${combo.comboType === 'bundle' ? t('bundleLabel', 'Bundle') : t('comboLabel', 'Combo')}
            </span></td>
            <td>${combo.price.toFixed(2)} €</td>
            <td>
                <button onclick="deleteProduct(${combo.id})" class="btn btn-danger btn-sm">
                    <i class="fas fa-trash"></i> ${t('delete', 'Delete')}
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
        alert(t('selectAtLeastTwoProductsBundle', 'Please select at least 2 products to create a bundle.'));
        return;
    }
    
    const selectedProducts = products.filter(p => selectedIds.includes(p.id));
    
    // Display selected products
    const productsList = document.getElementById('bundle-products-list');
    productsList.innerHTML = `
        <h4 style="margin-bottom: 10px;">${t('selectedProductsHeading', 'Selected Products:')}</h4>
        ${selectedProducts.map(p => `
            <div style="display: flex; align-items: center; gap: 10px; padding: 8px; background: white; border-radius: 4px; margin-bottom: 5px;">
                <img src="${p.image}" alt="${p.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">
                <div style="flex: 1;">
                    <strong>${p.name}</strong>
                    <div style="color: #666; font-size: 14px;">${p.price.toFixed(2)} €</div>
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
    document.getElementById('bundle-original-price').textContent = `${t('originalTotal', 'Original total:')} ${totalPrice.toFixed(2)} €`;
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
        alert(t('provideBundleNamePrice', 'Please provide a bundle name and valid price!'));
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
            alert(t('comboCreatedSuccess', 'Combo/Bundle created successfully!'));
            closeBundleModal();
            manageSelected.clear();
            document.getElementById('manage-select-all').checked = false;
            await loadProducts();
            loadCombos();
        } else {
            alert(t('comboCreateFailed', 'Failed to create combo/bundle'));
        }
    } catch (error) {
        console.error('Error creating bundle:', error);
        alert(t('comboCreateError', 'Error creating combo/bundle'));
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
        citiesList.innerHTML = `<p style="color: #666; text-align: center; padding: 20px;">${t('noCitiesYet', 'No cities added yet. Add your first city above.')}</p>`;
        return;
    }
    
    citiesList.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">${t('cityName', 'City Name')}</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">${t('deliveryPriceEur', 'Delivery Price (EUR)')}</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">${t('actions', 'Actions')}</th>
                </tr>
            </thead>
            <tbody>
                ${cities.map((city, index) => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding: 12px;">${city.name}</td>
                        <td style="padding: 12px; text-align: center;">€${parseFloat(city.price).toFixed(2)}</td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick="editCity(${index})" class="btn btn-sm" style="padding: 5px 10px; margin-right: 5px;">
                                <i class="fas fa-edit"></i> ${t('edit', 'Edit')}
                            </button>
                            <button onclick="deleteCity(${index})" class="btn btn-sm btn-danger" style="padding: 5px 10px;">
                                <i class="fas fa-trash"></i> ${t('delete', 'Delete')}
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
        alert(t('enterCityName', 'Please enter a city name'));
        return;
    }
    
    if (isNaN(price) || price < 0) {
        alert(t('enterValidPrice', 'Please enter a valid price'));
        return;
    }
    
    // Check if city already exists
    if (cities.some(c => c.name === name)) {
        alert(t('cityAlreadyExists', `City "${name}" already exists`).replace('{name}', name));
        return;
    }
    
    cities.push({ name, price });
    
    await saveCities();
    
    nameInput.value = '';
    priceInput.value = '';
}

function editCity(index) {
    const city = cities[index];
    
    const newName = prompt(t('enterNewCityName', 'Enter new city name:'), city.name);
    if (!newName || newName.trim() === '') return;
    
    const newPrice = prompt(t('enterNewDeliveryPrice', 'Enter new delivery price (EUR):'), city.price);
    if (newPrice === null) return;
    
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) {
        alert(t('invalidPrice', 'Invalid price'));
        return;
    }
    
    cities[index] = { name: newName.trim(), price };
    saveCities();
}

function deleteCity(index) {
    const city = cities[index];
    
    if (!confirm(t('confirmDeleteCityNamed', `Are you sure you want to delete "${city.name}"?`).replace('{name}', city.name))) {
        return;
    }
    
    cities.splice(index, 1);
    saveCities();
}

async function saveCities() {
    try {
        const token = sessionStorage.getItem('adminToken');
        
        // Get current settings to preserve other fields
        const currentResponse = await fetch(`${API_URL}/settings/delivery`);
        const currentSettings = await currentResponse.json();
        
        // Convert cities array to object
        const cityPrices = {};
        cities.forEach(city => {
            cityPrices[city.name] = city.price;
        });
        
        const settings = {
            deliveryEnabled: currentSettings.deliveryEnabled !== false,
            freeDeliveryEnabled: currentSettings.freeDeliveryEnabled || false,
            freeDeliveryAmount: currentSettings.freeDeliveryAmount || 50,
            deliveryFee: currentSettings.deliveryFee || 5,
            cityPrices: cityPrices
        };
        
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
            alert(t('citiesSavedSuccess', 'Cities saved successfully!'));
        } else {
            alert(t('citiesFailedSave', 'Failed to save cities'));
        }
    } catch (error) {
        console.error('Error saving cities:', error);
        alert(t('citiesErrorSave', 'Error saving cities'));
    }
}
