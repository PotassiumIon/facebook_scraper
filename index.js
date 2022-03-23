// const HTMLParser = require('node-html-parser');
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
        this.resultsFolder = path.resolve(__dirname, 'results');
        this.downloadFolder = path.resolve(__dirname, 'results/downloads');
        this.inputFile = path.resolve(__dirname, 'input.html');
        this.outputFile = path.resolve(__dirname, 'results/output.txt');
        this.videosFile = path.resolve(__dirname, 'results/videoURLs.txt');
        this.imagesFile = path.resolve(__dirname, 'results/imageURLs.txt');
        this.errorLogFile = path.resolve(__dirname, 'errorlog.txt');
        this.facebookVideoPath = 'https://www.facebook.com/watch/?v=';
        this.data = this.readFile(this.inputFile);
        this.window = new JSDOM(this.data).window;
        this.document = this.window.document;

        if (!fs.existsSync(path.resolve(__dirname, 'results'))) {
            fs.mkdirSync(path.resolve(__dirname, 'results'))
        }

        if (!fs.existsSync(this.downloadFolder)) {
            fs.mkdirSync(this.downloadFolder);
        }

        this.scrape();
    }

    /**
     * Parses HTML document for dates, posts, images, and video links.
     */
    async scrape() {

        const elements = this.document.getElementsByTagName('*');

        for (let i = 0; i < elements.length; i++) {
            let element = elements[i];

            switch (element.tagName) {
                case 'ABBR':
                    this.log("DATE: " + element.textContent, this.outputFile);
                    break;
                case 'P':
                    this.log(element.textContent, this.outputFile);
                    break;
                case 'DIV':
                    await this.processVideo(element);
                    break;
                case 'I':
                    await this.processImage(element);
                    break;
                default:
            }

        }

        console.log("Operation Complete");

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
     */
    async processImage(element) {
        let encodedImgURL = this.getImageURL(element);
        let decodedImgURL = this.decodeImageURL(encodedImgURL);
        if (decodedImgURL) {
            await this.processURL(decodedImgURL);
            this.log(decodedImgURL, this.imagesFile);
            this.log("IMAGE URL: " + decodedImgURL, this.outputFile);
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
     * Processes an image or video url
     * @param {String} url Absolute URL to file that needs to be downloaded
     */
    async processURL(url) {

        const fileName = this.getFileName(url);

        if (fileName) {
            const filePath = path.resolve(this.downloadFolder, fileName);

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
            this.log(err.stack, this.errorLogFile);
        }
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
            console.log(err, err.stack);
        }
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
     *  Scrapes div for video information
     * @param {Element} element 
     */
    async processVideo(element) {
        const videoURL = this.getVideoURL(element);
        const videoID = this.getVideoID(element);

        if (videoID) this.log(`CLICKABLE VIDEO LINK: ${this.facebookVideoPath}${videoID}`, this.outputFile);

        if (videoURL) {
            this.log("VIDEO SRC: " + videoURL, this.outputFile);
            this.log(videoURL, this.videosFile);
            this.processURL(videoURL);
        }

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

}

module.exports = FacebookScraper.instance;