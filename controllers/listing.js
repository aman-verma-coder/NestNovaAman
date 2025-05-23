const Listing = require("../models/listings.js");
const mbxGeoCoding = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeoCoding({ accessToken: mapToken });

// Search functionality
module.exports.searchListings = async (req, res) => {
    const { q } = req.query;
    if (!q || q.trim() === "") {
        return res.redirect("/listings");
    }

    // Search in title, description, location and country fields
    // Only show approved listings in search results
    const allListings = await Listing.find({
        $and: [
            { status: "approved" },
            {
                $or: [
                    { title: { $regex: q, $options: "i" } },
                    { description: { $regex: q, $options: "i" } },
                    { location: { $regex: q, $options: "i" } },
                    { country: { $regex: q, $options: "i" } },
                    { category: { $regex: q, $options: "i" } }
                ]
            }
        ]
    });

    // Track search query for logged-in users
    if (req.user) {
        try {
            await RecommendationService.trackSearchQuery(req.user._id, q);
        } catch (error) {
            console.error('Error tracking search query:', error);
            // Non-critical error, continue with page rendering
        }
    }

    res.render("listings/index.ejs", { allListings, searchQuery: q });
};

function getObjectKey(object) {
    for (let prop in object) {
        if (object.hasOwnProperty(prop)) {
            return prop;
        }
    }
}
module.exports.postNewListing = async (req, res) => {
    let url = req.file.path;
    let filename = req.file.filename;
    const newListing = new Listing(req.body.listing);
    newListing.owner = req.user._id;
    newListing.image = { url, filename };
    newListing.status = "pending"; // Set status to pending by default
    await newListing.save();
    req.flash("success", "New Listing Created! It will be visible after admin approval.");
    res.redirect("/listings");
};

module.exports.index = async (req, res) => {
    // Only show approved listings to regular users
    // Admin users can see all listings in the admin dashboard
    const statusFilter = { status: "approved" };
    // Recommendations have been removed from the home page
    let recommendedListings = [];

    if (getObjectKey(req.query)) {
        let allListings = await Listing.find({
            category: { $in: getObjectKey(req.query) },
            ...statusFilter
        });
        console.log(allListings);
        res.render("listings/index.ejs", { allListings, recommendedListings });
        // res.send("All Ok");
    }
    else {
        let allListings = await Listing.find(statusFilter);
        res.render("listings/index.ejs", { allListings, recommendedListings });
        // res.send("Not Ok");
    }
};

// Import recommendation service
const RecommendationService = require("../services/recommendationService.js");

module.exports.show = async (req, res) => {
    let { id } = req.params;
    let showData = await Listing.findById(id)
        .populate({
            path: "review",
            // Only show approved reviews to users
            match: { status: "approved" },
            populate: { path: "author" }
        })
        .populate("owner");

    // Add full URL for social sharing
    const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    // console.log(`Show Data${showData}`);
    if (!showData) {
        req.flash("error", "Listing Does not exist");
        return res.redirect("/listings");
    }

    // Check if the listing is pending or rejected and the current user is not the owner or admin
    if ((showData.status === "pending" || showData.status === "rejected") &&
        (!req.user || (!req.user.isAdmin && !showData.owner._id.equals(req.user._id)))) {
        req.flash("error", "This listing is not available");
        return res.redirect("/listings");
    }

    // Track user view for recommendations if user is logged in
    if (req.user) {
        try {
            await RecommendationService.trackListingView(req.user._id, id);
        } catch (error) {
            console.error('Error tracking listing view:', error);
            // Non-critical error, continue with page rendering
        }
    }

    // console.log(showData.geometry.coordinates);
    console.log(showData);
    res.render("listings/show.ejs", { showData, fullUrl });
};

module.exports.renderNewForm = (req, res) => {
    res.render("listings/newListing.ejs");
};

module.exports.postNewListing = async (req, res, next) => {
    let response = await geocodingClient.forwardGeocode({
        query: req.body.location,
        limit: 2
    })
        .send();
    // console.log(req.body.location);
    // console.log(response.body.features[0].geometry);
    // res.send("All Ok");
    let url = req.file.path;
    let filename = req.file.filename;
    // console.log(url, "..", filename);
    const newListing = new Listing(req.body);
    newListing.owner = req.user._id;
    newListing.image = { url, filename };
    newListing.geometry = response.body.features[0].geometry;
    newListing.status = "pending"; // Set status to pending by default
    let savedListing = await newListing.save();
    console.log(savedListing);
    req.flash("success", "New Listing Added! It will be visible after admin approval.");
    res.redirect("/listings");

};

module.exports.renderEditForm = async (req, res) => {
    let { id } = req.params;
    console.log(id);
    let editNeeded = await Listing.findById(id);
    console.log(`Data to be edited: ${editNeeded}`);
    if (!editNeeded) {
        req.flash("error", "Listing Does not exist");
        res.redirect("/listings");
    }
    let originalImageUrl = editNeeded.image.url;
    originalImageUrl = originalImageUrl.replace("/upload", "/upload/w_250");
    res.render("listings/editListingData.ejs", { editNeeded, originalImageUrl });
};

module.exports.putEditListing = async (req, res) => {
    let updatedData = req.body;
    let { id } = req.params;
    let editNeeded = await Listing.findByIdAndUpdate(id, { ...updatedData });
    if (typeof req.file !== "undefined") {
        let url = req.file.path;
        let filename = req.file.filename;
        editNeeded.image = { url, filename };
        await editNeeded.save();
    }
    // console.log(`Updated ID: ${id}`);
    // console.log(`Updated Data: ${updatedData}`);
    console.log(`Updated Data: ${editNeeded}`);
    req.flash("success", "Listing Edited");
    res.redirect(`/listings/${id}/show`);
    // res.send("All Ok");
};

// module.exports.filterListings = (req, res) => {
//     let filter = req.body;
//     console.log(filter);
//     res.send("All Ok");
// };

module.exports.deleteListing = async (req, res) => {
    let { id } = req.params;
    console.log(`Element to be deleted's ID: ${id}`);
    await Listing.findByIdAndDelete(id);
    req.flash("success", "Listing Deleted");
    res.redirect("/listings");
    // res.send("All Ok");
};