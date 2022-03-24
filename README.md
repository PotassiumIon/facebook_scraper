# HTML Scraper for Facebook Profile

## About
Scrapes a single Facebook profile and downloads the dates, posts, images and video links to a local folder.

Doesn't require facebook graph api, but it can only scrape what is publicly available through the mobile site.

## Requirements
NodeJS
Internet Connection
Internet Browser

## How to Scrape Facebook Profile
Load the `https://m.facebook.com/<username>/posts/?ref=page_internal&mt_nav=0` url in your browser replacing the username with the actual username.

Click on the feeds tab

Scroll down until you have all the wanted posts loaded onto the page

***LIFE HACK: You can automatically scroll by clicking and holding the left mouse button near the bottom of the scroll bar, and while holding the left mouse button click the right mouse button. As long as you don't interact with the broswer, it should continue to scroll.***

Right click the page and click inspect

On the right hand side right click the `<body>` tag and click edit as html

Wait for the code to appear

Select all the code in the diolog box that appears

Paste the copied text into the input.html file in the root folder of the project

In your terminal, navigate to the root folder of this project

Run `npm install` in the commands line

Run `npm start` in the command line

The output will be saved to the outputs folder in the root of this project