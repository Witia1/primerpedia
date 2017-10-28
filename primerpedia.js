/* There are 3 ways (that I know about) of getting the first section of an article.
 * 1) We can use action=parse coupled with the section=0 parameter,
 *    but the "page" parameter needs to be supplied,
 *    which means that we'd have to make two API requests
 *    (either to get a random page, or to resolve a search term)
 *    btw, this action seems to have a mobileformat= parameter, but the resuts are poor.
 * 2) Another option is to use the prop=revisions query, coupled with rvprop=content,
 *    &rvsection=0 and rvparse=true (see https://stackoverflow.com/q/13517901/266309).
 *    This request can be combined with a random article generator,
 *    using generator=random&grnnamespace=0,
 *    or with a search generator, using generator=search.
 *    But the parser returns the full html, so we'd have to clean it up ourselves.
 * 3) The third option (and the one we are using at the moment) is the prop=extracts query
 *    (from Extension:TextExtracts, https://www.mediawiki.org/wiki/Extension:TextExtracts),
 *    coupled with the "exintro" parameter.
 *    This can be paired with a random page generator, or a search generator.
 *    The cleanup is pretty good, but links are removed (maybe not a bad thing)
 *    and some templates are still displayed, so they need to be hidden via css.
 */

var apiUrl = "https://en.wikipedia.org/w/api.php?";
// https://www.mediawiki.org/wiki/Extension:MobileFrontend#prop.3Dextracts
var apiExtractsQuery = "action=query&prop=extracts&exintro&indexpageids=true&format=json";
var requestTimeoutInMs = 3000;
var requestCallbackName = "requestCallback";

var searchTermInputElement = null;
var contentDivElement = null;
var viewLinkElem = null;
var editLinkElement = null;
var articleTitleElement = null;
var licenseIconElement = null;
var infoIconElement = null;

function random() {
	searchTermInputElement.value = "";
	apiRequest(apiExtractsQuery + "&generator=random&grnnamespace=0");
}

function search() {
	var searchTerm = searchTermInputElement.value;
	if(searchTerm)
		apiRequest(apiExtractsQuery + "&generator=search&gsrlimit=1&gsrsearch=" + searchTerm);
	else random();
}

function apiRequest(queryString) {
	// Show animated loading spinner -- from https://commons.wikimedia.org/wiki/File:Chromiumthrobber.svg
	contentDivElement.innerHTML = "<img src='img/loading.svg' alt='Loading...' id='loading-spinner'/>";

	var script = document.createElement("script");
	script.type = "text/javascript";
	script.async = true;
	script.src = apiUrl + queryString + "&callback=" + requestCallbackName;

	document.getElementsByTagName("head")[0].appendChild(script);

	var onCompleted = function () {
		// reduce global namespace pollution
		delete (window[requestCallbackName]);
		// remove jsonp result tag
		script.remove();
	}

	var requestTimeout = window.setTimeout(function () {
		onCompleted();
	}, requestTimeoutInMs);

	window[requestCallbackName] = function (jsonObject) {
		window.clearTimeout(requestTimeout);

		handleRequestResult(jsonObject);

		onCompleted();
	}
}

function toggleVisibility(element, visibility) {
	if(element instanceof HTMLElement) {
		if(!visibility) {
			element.style.setProperty("display", "none");
		} else {
			element.style.removeProperty("display");
		}
	}
}

function clearNode(node) {
	var clone = node.cloneNode(false);
	node.parentNode.replaceChild(clone, node);

	return clone;
}

function renderSearchResult(jsonObject) {
	var pageid = jsonObject.query.pageids[0];
	var article = jsonObject.query.pages[pageid];
	article.url = "https://en.wikipedia.org/wiki/" + encodeURIComponent(article.title);
	var editlink = article.url + "?action=edit&amp;section=0";

	viewLinkElem.textContent = article.title;
	viewLinkElem.setAttribute("href", article.url);

	editLinkElement.setAttribute("href", editlink);
	toggleVisibility(articleTitleElement, true);

	contentDivElement = clearNode(contentDivElement);
	contentDivElement.innerHTML = article.extract;

	toggleVisibility(licenseIconElement, true);
	toggleVisibility(infoIconElement, true);
}

function renderNotFoundNode() {
	toggleVisibility(articleTitleElement, false);
	toggleVisibility(licenseIconElement, false);
	toggleVisibility(infoIconElement, false);

	var notFoundNode = document.createElement("div");
	notFoundNode.classList.add("error");
	notFoundNode.textContent = "The search term wasn't found.";

	contentDivElement = clearNode(contentDivElement);

	contentDivElement.appendChild(notFoundNode);
}

function handleRequestResult(jsonObject) {
	if(jsonObject.hasOwnProperty("query")) {
		var searchData = jsonObject.query.searchinfo;

		if(typeof searchData === "undefined" || searchData.totalhits > 0) {
			renderSearchResult(jsonObject);

			return;
		} else if(typeof searchData.suggestion !== "undefined") {
			apiRequest(apiExtractsQuery + "&generator=search&gsrlimit=1&gsrsearch=" + searchData.suggestion);

			return;
		}
	}

	renderNotFoundNode();
}

// Get query string from URL parameter
// https://stackoverflow.com/a/2091331/266309
function getQueryVariable(parameter) {
	// Get query string, excluding the first character, '?'
	var query = window.location.search.substring(1);
	// Split each parameter=value pair using '&' as separator
	var vars = query.split('&');
	// Loop over all the parameter=value pairs, and split them into their parameter/value components
	for(var i = 0; i < vars.length; i++) {
		var pair = vars[i].split('=');
		// If one of the parameter names is the one we're looking for, return its value
		if(decodeURIComponent(pair[0]) == parameter) {
			return decodeURIComponent(pair[1]);
		}
	}
	return null;
}

// Upon loading the page, check if an URL parameter was passed, and use it to perform a search
window.onload = function () {
	searchTermInputElement = document.getElementById("search-term");
	contentDivElement = document.getElementById("content");
	viewLinkElem = document.getElementById("viewlink");
	editLinkElement = document.getElementById("editlink");
	articleTitleElement = document.getElementById("article-title");
	licenseIconElement = document.getElementById("license-icon");
	infoIconElement = document.getElementById("info-icon");

	var queryParam = getQueryVariable("search");

	if(queryParam !== null) {
		searchTermInputElement.value = queryParam;
		search();
	}
}
