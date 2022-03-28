const JSDOM = require('jsdom').JSDOM;
const fs = require('fs');
const axios = require('axios').default;
const path = require('path');

/**
 * Singleton class that is instantiated, 
 * and runs the scraper automatically before terminating
 */
class FacebookScraper {

    static instance = new FacebookScraper();

    constructor() {
        this.outputsFolder = path.resolve(__dirname, 'outputs');
        this.inputFile = path.resolve(__dirname, 'input.html');
        this.videosFile = path.resolve(__dirname, 'outputs/videoURLs.txt');
        this.imagesFile = path.resolve(__dirname, 'outputs/imageURLs.txt');
        this.errorLogFile = path.resolve(__dirname, 'outputs/errorlog.txt');
        this.facebookVideoPath = 'https://www.facebook.com/watch/?v=';

        if (!fs.existsSync(this.outputsFolder)) {
            fs.mkdirSync(this.outputsFolder);
        }

        this.scrape();
    }

    /**
     * Parses HTML document for dates, posts, images, and video links.
     */
    async scrape() {

        console.log("Operation Started");

        const data = this.readFile(this.inputFile);
        const window = new JSDOM(data).window;
        const document = window.document;
        const body = document.body;
        const elements = body.getElementsByTagName('*');

        await this.processElements(elements);

        console.log("Operation Complete");

    }

    /**
     * Processes a list of elements
     * @param {HTMLCollectionOf<Element>} elements 
     */
    async processElements(elements) {

        let outputFolder = null;
        let outputFile = null;

        for (let i = 0; i < elements.length; i++) {
            let element = elements.item(i);

            switch (element.tagName) {
                case 'ABBR':
                    let unparsedDate = element.textContent;
                    let parsedDate = unparsedDate.replace(/\s+/g, '').replace(',', '-').replace('at', '-').replace(':', '').split("-");
                    let formattedDate = parsedDate[1] + "-" + parsedDate[0] + "-" + parsedDate[2];
                    outputFolder = path.resolve(this.outputsFolder, formattedDate);
                    if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder);
                    outputFile = path.resolve(outputFolder, "post.txt");
                    this.log("TIMESTAMP: " + parsedDate, outputFile);
                    break;
                case 'P':
                    let caption = element.textContent.trim().replace(/\s\s+/g, ' ').replace(/\n\s*\n/g, '\n');
                    if (outputFile) this.log("CAPTION: " + caption, outputFile);
                    break;
                case 'DIV':
                    if (outputFile) await this.processVideo(element, outputFolder, outputFile);
                    break;
                case 'I':
                    if (outputFile) await this.processImage(element, outputFolder, outputFile);
                    break;
                default:
            }
        }
    }

    /**
     * Reads the html file
     * @param {String} filePath 
     * @returns {String} The loaded string data
     */
    readFile(filePath) {
        let data = null;

        try {
            data = fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            this.log(e, this.errorLogFile);
        }
        return data;
    }


    /**
     * Srapes a facebook I element.
     * @param {Element} element a facebook I element
     * @param {String} outputFolder path to output folder
     * @param {String} outputFile path to output file
     */
    async processImage(element, outputFolder, outputFile) {
        let encodedImgURL = this.getImageURL(element);
        let decodedImgURL = this.decodeImageURL(encodedImgURL);
        if (decodedImgURL) {
            this.log(decodedImgURL, this.imagesFile);
            this.log("IMAGE URL: " + decodedImgURL, outputFile);
            await this.processURL(decodedImgURL, outputFolder);
        }
    }

    /**
     * Gets the url hidden in the style attribute of an i element.
     * @param {Element} element 
     * @returns {String} the url string
     */
    getImageURL(element) {
        let url = "";
        let style = element.getAttribute('style');
        if (style && style.includes('http')) {
            const start = style.lastIndexOf(`https`);
            const end = style.indexOf("'", start + 1);
            url = style.slice(start, end);
        }
        return url;
    }

    /**
     * Decode image url used by facebook
     * @param {String} url The encoded url string 
     * @returns {String} The decoded url
     */
    decodeImageURL(url) {
        let decodedImgURL = url;

        decodedImgURL = decodedImgURL.replaceAll("\\3a ", "\:");
        decodedImgURL = decodedImgURL.replaceAll("\\3d ", "\=");
        decodedImgURL = decodedImgURL.replaceAll("\\26 ", "\&");

        return decodedImgURL;
    }

    /**
     * Downloads the file and writes it to the specified path
     * @param {String} url 
     * @param {String} path 
     */
    async downloadFile(url, path) {
        try {
            const response = await axios({
                method: "GET",
                url: url,
                responseType: "stream",
            });

            await response.data.pipe(fs.createWriteStream(path));

        } catch (err) {
            this.log(url, this.errorLogFile);
            this.log(err.stack, this.errorLogFile);
        }
    }

    /**
     *  Scrapes div for video information
     * @param {Element} element div element with video information
     * @param {String} outputFolder path to the output folder
     * @param {String} outputFile path to the output file
     */
    async processVideo(element, outputFolder, outputFile) {
        const videoURL = this.getVideoURL(element);
        const videoID = this.getVideoID(element);

        if (videoID) this.log(`CLICKABLE VIDEO URL: ${this.facebookVideoPath}${videoID}`, outputFile);

        if (videoURL) {
            this.log("VIDEO URL: " + videoURL, outputFile);
            this.log(videoURL, this.videosFile);
            this.processURL(videoURL, outputFolder);
        }
    }

    /**
     * Processes an image or video url
     * @param {String} url Absolute URL to file that needs to be downloaded
     * @param {String} folder path to the folder to download to
     */
    async processURL(url, folder) {

        const fileName = this.getFileName(url);

        if (fileName) {
            const filePath = path.resolve(folder, fileName);

            await this.downloadFile(url, filePath);
        }
    }

    /**
     * Parses file name of a url
     * @param {String} url of a file from the internet.
     * @returns {String} parsed url
     */
    getFileName(url) {
        let baseName = path.basename(url);
        let fileName = null;

        if (baseName.includes(".jpg")) {
            fileName = baseName.slice(0, baseName.indexOf(".jpg") + 4);
        } else if (baseName.includes(".mp4")) {
            fileName = baseName.slice(0, baseName.indexOf(".mp4") + 4);
        }

        return fileName;
    }

    /**
     * Gets the video URL from the element
     * @param {Element} element 
     * @returns {String} The resulting url
     */
    getVideoURL(element) {

        let src = "";
        let dataStore = element.getAttribute('data-store');

        if (dataStore) {
            dataStore = JSON.parse(dataStore);
            src = dataStore.src;
        }

        return src;

    }

    /**
     * Gets video id from facebook div with video content
     * @param {HTMLParser.HTMLElement} element 
     */
    getVideoID(element) {
        let videoID = "";
        let dataStore = element.getAttribute('data-store');
        if (dataStore) {
            dataStore = JSON.parse(dataStore);
            videoID = dataStore.videoID;
        }

        return videoID;
    }

    /**
     * Logs data to a local file
     * @param {String} message data to be logged
     * @param {String} file path to output file
     */
    log(message, file) {
        try {
            fs.appendFileSync(file, `\n\n${message}`);
        } catch (e) {
            console.log(e, e.stack);
        }
    }

}
