const { createCanvas, loadImage } = require("@napi-rs/canvas");

const site = "http://mlimon.io/newmini";

const mockupGeneratorAjax = {
    image_save_endpoint: `${site}/wp-json/alaround-generate/v1/save-mockup`,
    info_save_endpoint: `${site}/wp-json/alaround-generate/v1/save-info`
};

/**
 * Image Generation System
 */

const itemPushEachAtOnce = 20;
let imageResultList = [];
let isGeneratingImages = false; // Flag to track whether image generation is in progress
const userQueue = []; // Queue to store users for processing
const enableBackgroundColor = false;

// Define a variable to control logging
let enableLogging = false;

// Custom logging function
const customLog = (...args) => {
    if (enableLogging) {
        // console.log(...args);
    }
};
    
function convertBackgrounds(images) {
    let backgrounds = [];

    for (let key in images) {
        if (images.hasOwnProperty(key)) {
        backgrounds.push({
            id: key,
            url: images[key]['thumbnail'][0],
            galleries: images[key]['galleries']
        });
        }
    }

    return backgrounds;
}

function convertLogos(logos) {
    let backgrounds = [];

    for (let key in logos) {
        if (logos.hasOwnProperty(key)) {
            // If the value is an array, iterate through its elements
            if (Array.isArray(logos[key])) {
                logos[key].forEach((item, index) => {
                    backgrounds.push({
                        product_id: parseInt(key),
                        meta_key: item['meta_key'],
                        meta_value: item['meta_value']
                    });
                });
            } else {
                backgrounds.push({
                    id: key,
                    url: logos[key][0]
                });
            }
        }
    }

    return backgrounds;
}

function convertGallery(images) {
    let gallery = [];
    
    for (let key in images) {
        if (images.hasOwnProperty(key)) {
        gallery.push({
            id: key,
            attachment_id: images[key]['attachment_id'],
            url: images[key]['thumbnail'],
            type: images[key]['type']
        });
        }
    }
    
    return gallery;
}

// Function to calculate new dimensions while maintaining aspect ratio
function calculateNewDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
    const aspectRatio = originalWidth / originalHeight;
    
    // Check if resizing is needed
    if (originalWidth > maxWidth || originalHeight > maxHeight) {
        if (maxWidth / aspectRatio <= maxHeight) {
        return { newWidth: maxWidth, newHeight: maxWidth / aspectRatio };
        } else {
        return { newWidth: maxHeight * aspectRatio, newHeight: maxHeight };
        }
    } else {
        return { newWidth: originalWidth, newHeight: originalHeight };
    }
}


    // Function to calculate new y position to keep the image centered
function calculateCenteredY(originalY, originalHeight, newHeight) {
    return originalY + (originalHeight - newHeight) / 2;
}

function aspect_height(originalWidth, originalHeight, newWidth) {
    // Calculate the aspect ratio
    const aspectRatio = originalWidth / originalHeight;

    // Calculate the new height based on the aspect ratio
    const newHeight = newWidth / aspectRatio;

    return newHeight;
}

function aspectY(newHeight, height, y) {
    const newY = height > newHeight ? y + (height - newHeight) : y - ((newHeight - height)/2);
    return newY;
}


function getFileExtensionFromUrl(url) {
    // Use a regular expression to extract the file extension
    const regex = /(?:\.([^.]+))?$/; // Match the last dot and anything after it
    const extension = regex.exec(url)[1]; // Extract the extension (group 1 in the regex)

    // Ensure the extension is in lowercase (optional)
    if (extension) {
        return extension.toLowerCase();
    } else {
        return null; // Return null if no extension is found
    }
}

// Function to generate an image with logos
const generateImageWithLogos = async (backgroundUrl, user_id, product_id, logo, logo_second, custom_logo, logoData, logo_type, custom_logo_type, gallery = false) => {

    let itemResult = []

    // Extract the filename from the background URL
    const file_ext = getFileExtensionFromUrl(backgroundUrl);
    let filename = product_id + '.' + file_ext;
    let is_feature_image = false === gallery ? true : false;

    //customLog("gallery", gallery);
    if( gallery && gallery !== false && gallery.length !== 0 ) {
        filename = product_id + '-' + gallery['id'] + '-' + gallery['attachment_id'] + '.' + file_ext;
    }

    // console.log('backgroundUrl', backgroundUrl);

    const backgroundImage = await loadImage(backgroundUrl);

    const staticCanvas = createCanvas(backgroundImage.width, backgroundImage.height);
    const ctx = staticCanvas.getContext('2d');

    // Draw the background image
    ctx.drawImage(backgroundImage, 0, 0);

    // Use Array.filter() to get items with the matching product_id
    const itemsWithMatchingProductID = logoData.filter(item => item.product_id == product_id);

    // //customLog( 'itemsWithMatchingProductID', itemsWithMatchingProductID );

    // Find an item with the matching meta_key "ml_logos_positions_{user_id}"
    const matchingItem = itemsWithMatchingProductID.find(item => item.meta_key === `ml_logos_positions_${user_id}`);

    // //customLog( 'matchingItem', matchingItem );

    // If found, use it; otherwise, fall back to "ml_logos_positions"
    const resultItem = matchingItem || itemsWithMatchingProductID.find(item => item.meta_key === "ml_logos_positions");

    // //customLog( 'resultItem', resultItem );

    // console.log(`====> is_feature:${is_feature_image} id:${product_id} user:${user_id} logo_type:${logo_type} custom_logo_type:${custom_logo_type}`, resultItem);

    if (resultItem != undefined) {
        
        let finalItem = resultItem.meta_value[logo_type];
        let logoNumber = resultItem.meta_value['logoNumber'];
            logoNumber = logoNumber !== undefined ? logoNumber : 'default';
        
        // console.log("logo_type", logo_type, finalItem);

        // check if select second logo or not
        // check if second logo value exists or not
        let finalLogo = logo;
        let finalLogoNumber = 'lighter';

        if(logoNumber === 'second' && (logo_second && logo_second != null && logo_second != undefined)) {
            finalLogo = logo_second;
            finalLogoNumber = 'darker';
        }

        if( 578 === product_id ) {
            console.log('gallery', gallery);
        }

        if( gallery && gallery !== false && gallery.length !== 0 ) {
            
            if( gallery['type'] === 'lighter' ) {
                finalLogo = logo;
                finalLogoNumber = 'lighter';
            }
            if( gallery['type'] === 'darker' && (logo_second && logo_second != null && logo_second != undefined) ) {
                finalLogo = logo_second;
                finalLogoNumber = 'darker';
            }

            if( 578 === product_id ) {
                console.log('finalLogo', finalLogo);
                console.log('finalLogoNumber', finalLogoNumber);
                console.log('logo_second', logo_second);
            }
        }

        

        if (finalItem !== undefined && finalItem !== false) {

            // console.log(`finalItem:${finalItem} id:${product_id} user:${user_id} finalLogoNumber:${finalLogoNumber}`, resultItem);

            let imgData = {
                url: finalLogo,
                product_id: product_id,
                user_id: user_id,
                custom_logo: custom_logo,
                finalLogoNumber: finalLogoNumber,
                logoNumber: logoNumber,
                is_feature: is_feature_image
            };
            
            // Loop through the logo data and draw each logo on the canvas
            for (const [index, logoInfo] of finalItem.entries()) {
                let { x, y, width, height, angle, custom } = logoInfo;

                imgData['custom'] = custom;

                const logoImage = await loadLogoImage(imgData);

                // console.log(`--- is_feature:${is_feature_image} custom:${custom} id:${product_id} user:${user_id}`);

                // if custom then check logo_type by image size
                // then get that type value from resultItem
                // and re-initialize x, y, width, height, angle again with new values.
                if( custom === true ) {
                    // console.log( imgData );
                    console.log(`----------- custom ${custom} custom_logo ${custom_logo} user_id ${user_id} product: ${product_id}`);
                    let get_type = get_orientation(logoImage);
                    if (custom_logo_type && (custom_logo_type === "horizontal" || custom_logo_type === "square")) {
                        // console.log(`ProductID:${product_id} Type:${custom_logo_type}`);
                        get_type = custom_logo_type;
                    }

                    // overwrite get_type if custom_logo[finalLogoNumber] == false. in short if custom logo with finalLogoNumber is emmpty.
                    if (
                        custom_logo !== undefined &&
                        custom_logo.hasOwnProperty(finalLogoNumber) && 
                        custom_logo[finalLogoNumber] == false
                    ) {
                        get_type = logo_type;
                    }
                    

                    let get_type_values = resultItem.meta_value[get_type];
                    
                    // console.log("get_type", get_type, get_type_values);
                    if( get_type_values[index] && get_type_values[index] != null && get_type_values[index] != undefined ) {

                        // console.log(`--- get_type:${get_type} is_feature:${is_feature_image} id:${product_id} user:${user_id} index:${index}`, get_type_values);

                        ({ x, y, width, height, angle } = get_type_values[index]);
                    }
                }

                // Use the original width and height of the logo
                const originalWidth = logoImage.width;
                const originalHeight = logoImage.height;

                customLog('enableBackgroundColor', enableBackgroundColor, typeof enableBackgroundColor);

                if ( enableBackgroundColor !== false ) {
                    // Draw the background with rotation
                    ctx.save();
                    ctx.translate(x + width / 2, y + height / 2);
                    ctx.rotate(angle);
                    ctx.fillStyle = "lightblue"; // Set background color, you can change this to any color
                    ctx.fillRect(-width / 2, -height / 2, width, height);
                    ctx.restore();

                    customLog('added a logo background!');
                }

                // Calculate the new dimensions while maintaining the aspect ratio
                let { newWidth, newHeight } = calculateNewDimensions(originalWidth, originalHeight, width, height);

                // Calculate new y position to keep the image centered
                let newY = calculateCenteredY(y, height, newHeight);

                if (angle === 0) {
                    customLog("width force to full");
                    newHeight = aspect_height(originalWidth, originalHeight, width);
                    newWidth = width;
                    newY =  calculateCenteredY(y, height, newHeight);
                }

                ctx.save();
                ctx.translate(x + width / 2, newY + newHeight / 2);
                ctx.rotate(angle);
                ctx.drawImage(logoImage, -newWidth / 2, -newHeight / 2, newWidth, newHeight);
                ctx.restore();
            }

            const dataURL = staticCanvas.toDataURL('image/jpeg', 1);

            // Call the function and wait for the result
            const result = {dataURL, filename, user_id, is_feature_image};

            // Convert response data to JSON string
            const responseDataString = JSON.stringify(result);

            // Calculate the size of the response data in bytes
            const responseSizeInBytes = Buffer.byteLength(responseDataString, 'utf8');

            // Calculate the size of the response data in megabytes
            const responseSizeInMB = responseSizeInBytes / (1024 * 1024);

            // Log the response size in both bytes and megabytes
            console.log('Response size:', responseSizeInBytes, 'bytes');
            console.log('Response size:', responseSizeInMB.toFixed(2), 'MB');
            

             // Now you can check the result
            if ( ! result ) {
                console.error(`Image save operation failedm, filename: ${$filename}`);
                return false;
            }

            return result;
        }
    }
};


function get_orientation(attachment_metadata) {
    // Get attachment metadata
    if (attachment_metadata) {

        // Calculate the threshold for height to be less than 60% of width
        const heightThreshold = 0.6 * attachment_metadata.width;

        // Check if width and height are equal (square)
        if (attachment_metadata.width === attachment_metadata.height) {
            return 'square';
        } else if (attachment_metadata.height < heightThreshold) {
            return 'horizontal';
        } else {
            return 'square';
        }
    }
    return 'square';
}

function findInArray(needle, array) {
    return array.find(element => element === needle) !== undefined;
}

// Function to check if product exists in the allow_products array
function checkProductExists(product_id, custom_logo) {
    if( custom_logo.allow_products == null || custom_logo.allow_products.length < 1 ) {
        return false;
    }
    for (let i = 0; i < custom_logo.allow_products.length; i++) {
        if (custom_logo.allow_products[i] == product_id) {
        return true;
        }
    }
    return false;
}


// Function to load a logo image
const loadLogoImage = async (imgData) => {
    const { url, product_id, user_id, is_feature, custom, custom_logo, finalLogoNumber, logoNumber } = imgData;
    console.log( "-------------- inside loadlogoimage" );
    let fetchUrl = url;
    if( true === custom && custom_logo != null) {
        console.log( `-------------- first layer loadlogoimage product_id ${product_id}` );
        if (
            custom_logo.hasOwnProperty("allow_products") && 
            Array.isArray(custom_logo.allow_products) && 
            checkProductExists(product_id, custom_logo)
        ) {
            console.log( "-------------- second layer loadlogoimage" );
            if (
                custom_logo.hasOwnProperty(finalLogoNumber) && 
                custom_logo[finalLogoNumber] && 
                custom_logo.finalLogoNumber !== ""
            ) {
                console.log( "-------------- final layer loadlogoimage" );
                fetchUrl = custom_logo[finalLogoNumber];
            }
        }
    }

    return await loadImage(fetchUrl);
};

const loadSimpleImage = async (url) => {
    const logoResponse = await fetch(url);
    if (!logoResponse.ok) {
        throw new Error(`Failed to fetch logo image: ${url}`);
    }
    const logoBlob = await logoResponse.blob();
    return await createImageBitmap(logoBlob);
};


// Function to perform the image generation
const generateImages = async (task) => {
    const { backgroundUrl, logo, logo_second, custom_logo, user_id, product_id, logoData, logo_type, custom_logo_type, galleries } = task;

    console.log(`backgroundUrl ${backgroundUrl} logo ${logo} logo_second ${logo_second} custom_logo ${custom_logo} user_id ${user_id} product_id ${product_id} logoData ${logoData} logo_type ${logo_type} custom_logo_type ${custom_logo_type}`);

    const promises = [];

    promises.push(generateImageWithLogos(backgroundUrl, user_id, product_id, logo, logo_second, custom_logo, logoData, logo_type, custom_logo_type));

    if (galleries && galleries.length !== 0) {
        const galleriesConvert = convertGallery(galleries);

        galleriesConvert.forEach((item, index) => {
            
            const galleryUrl = item['url'];
            const galleryType = item['type'];
            let galleryItem = item;

            // make lowercase galleryType
            if (galleryItem['type']) {
                galleryItem['type'] = galleryItem['type'].toLowerCase();
            }

            promises.push(generateImageWithLogos(galleryUrl, user_id, product_id, logo, logo_second, custom_logo, logoData, logo_type, custom_logo_type, galleryItem));
        });
    }

    // Wait for all promises to resolve and capture the results
    imageResultList = await Promise.all(promises);

    // Filter out the false values (failed image generation)
    imageResultList = imageResultList.filter(result => result !== false);

    return imageResultList; // Return the result list if needed elsewhere
};

/**
 * Retrieves the lighter and darker logo by product ID
 *
 * @param {Array} data - the array of objects containing lightness information
 * @param {string} productId - the ID of the product to retrieve lightness information for
 * @return {Array|null} an array of objects containing logo_lighter and logo_darker properties, or null if no matching lightness information is found
 */
async function getLightnessByID(data, productId) {
    
    for (let key = 0; key < data.length; key++) {
        const item = data[key];
        
        // Check if at least one of logo_lighter or logo_darker is not empty
        if ((item.logo_lighter !== '' || item.logo_darker !== '') && item.select_products.includes(productId)) {
        return {
            lighter: item.logo_lighter,
            darker: item.logo_darker,
        }
        }
    }
    
    return null;
}

async function getLighter( data, logo ) {
    if ( data && data.lighter && data.lighter !== false ) {
        return data.lighter;
    }

    return logo;
}

async function getDarker( data, logo ) {
    if ( data && data.darker && data.darker !== false ) {
        return data.darker;
    }

    return logo;
}


function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

function getItemData(settings) {
    if (settings.length === 0)
        return false;

    if (
        !settings.logo ||
        !settings.user_id
    ) {
        customLog("required variables are undefined");
        return false;
    }

    const backgroundUrl = settings.backgroundUrl;
    if(!backgroundUrl) {
        return false;
    }

    let logoData = '';
    if (settings.logo_positions && settings.logo_positions.length !== 0) {
        logoData = convertLogos(settings.logo_positions);
    }

    let logo_type = settings.logo_type;

    const logo = settings.logo;
    const user_id = settings.user_id;
    let logo_second = settings.second_logo;
    let custom_logo = settings.custom_logo;
    let product_id = settings.product_id;
    let custom_logo_type = settings.custom_logo_type;
    let galleries = settings.galleries;
    // let custom_logo = undefined;

    if (logo_second && !isValidUrl(logo_second)) {
        // console.log('logo_second is not a valid URL. Setting to undefined or default.');
        logo_second = undefined; // or set to a default value
    }

    const task = { backgroundUrl, logo, logo_second, custom_logo, user_id, product_id, logoData, logo_type, custom_logo_type, galleries };

    // console.log(task);

    return task;
}

module.exports = async (req, res) => {
    // console.log(req.query);

    if (req.method === 'POST' && req.url === '/api/create') {

        try {
            const task = getItemData(req.body);

            console.log( "start: " + new Date() );

            // Perform image generation
            const batch = await generateImages(task);

            res.status(200).json({ 
                batch
            });
   
        } catch (error) {
            console.error('Error:', error);
    
            res.setHeader('Content-Type', 'application/json');
            res.status(500).json({ error: 'Internal Server Error' });
        }        
    } else {
        res.status(200).json({ 
            message: 'Hello, World! This is a POST request.',
            body: 'req.body',
            method: req.method,
            url: req.url,
            query: req.query
        });
    }
};