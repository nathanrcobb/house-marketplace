import { useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { getDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.config";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
import Spinner from "../components/Spinner";

const GEOCODE_API_KEY = process.env.REACT_APP_GEOCODE_API_KEY;

function EditListing() {
  // eslint-disable-next-line
  const [geolocationEnabled, setGeolocationEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [listing, setListing] = useState(null);
  const [coverImage, setCoverImage] = useState(null);
  const [formData, setFormData] = useState({
    type: "rent",
    name: "",
    bedrooms: 1,
    bathrooms: 1,
    parking: false,
    furnished: false,
    address: "",
    offer: false,
    regularPrice: 0,
    discountedPrice: 0,
    images: {},
    latitude: 0,
    longitude: 0,
  });

  // Destructure state to access independently of formData
  const {
    type,
    name,
    bedrooms,
    bathrooms,
    parking,
    furnished,
    address,
    offer,
    regularPrice,
    discountedPrice,
    images,
    latitude,
    longitude,
  } = formData;

  const auth = getAuth();
  const navigate = useNavigate();
  const params = useParams();

  // Redirect if listing is not owned by currentUser
  useEffect(() => {
    if (listing && listing.userRef !== auth.currentUser.uid) {
      navigate("/");
      toast.error("You cannot edit that listing");
    }
    // eslint-disable-next-line
  }, []);

  // Fetch listing to edit
  useEffect(() => {
    setLoading(true);
    const fetchListing = async () => {
      const docRef = doc(db, "listings", params.listingId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setListing(docSnap.data());
        setFormData({
          ...docSnap.data(),
          imageUrls: [],
          address: docSnap.data().location,
        });
        setLoading(false);
      } else {
        navigate("/");
        toast.error("Listing does not exist");
      }
    };

    fetchListing();
  }, [navigate, params.listingId]);

  // Sets userRef to logged in user
  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        setFormData({ ...formData, userRef: user.uid });
      } else {
        navigate("/signin");
      }
    });
    // eslint-disable-next-line
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    if (discountedPrice >= regularPrice) {
      setLoading(false);
      toast.error("Discounted price must be less than regular price");
      return;
    }

    if (images.length > 6) {
      setLoading(false);
      toast.error("Unable to upload more than 6 images");
      return;
    }

    let geolocation = {};
    let location;

    if (geolocationEnabled) {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${address}${
          GEOCODE_API_KEY ? `&key=${GEOCODE_API_KEY}` : ""
        }`
      );

      const data = await response.json();

      geolocation.lat = data.results[0]?.geometry.location.lat ?? 0;
      geolocation.lng = data.results[0]?.geometry.location.lng ?? 0;

      location =
        data.status === "ZERO_RESULTS"
          ? undefined
          : data.results[0]?.formatted_address;

      if (location === undefined || location.includes("undefined")) {
        setLoading(false);
        toast.error("Please enter a valid address");
        return;
      }
    } else {
      geolocation.lat = latitude;
      geolocation.lng = longitude;
    }

    // Store image in Firebase
    const storeImage = async (image) => {
      return new Promise((resolve, reject) => {
        const storage = getStorage();
        const fileName = `${auth.currentUser.uid}-${image.name}-${uuidv4()}`;

        const storageRef = ref(storage, "images/" + fileName);

        const uploadTask = uploadBytesResumable(storageRef, image);

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log("Upload is " + progress + "% done");
            switch (snapshot.state) {
              case "paused":
                console.log("Upload is paused");
                break;
              case "running":
                console.log("Upload is running");
                break;
              default:
                console.log("Error uploading image");
                break;
            }
          },
          (error) => {
            reject(error);
          },
          () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
              resolve(downloadURL);
            });
          }
        );
      });
    };

    const imageUrls = await Promise.all(
      [...images].map((image) => storeImage(image))
    ).catch(() => {
      setLoading(false);
      toast.error("Unable to upload images");
      return;
    });

    const formDataCopy = {
      ...formData,
      imageUrls,
      geolocation,
      timestamp: serverTimestamp(),
    };

    // Cleanup before save to database
    formDataCopy.location = address;
    delete formDataCopy.images;
    delete formDataCopy.address;
    !formDataCopy.offer && delete formDataCopy.discountedPrice;

    // Update listing
    const docRef = doc(db, "listings", params.listingId);
    await updateDoc(docRef, formDataCopy);
    setLoading(false);
    toast.success("Listing successfully updated!");
    navigate(`/category/${formDataCopy.type}/${docRef.id}`);
  };

  const onMutate = (e) => {
    let boolean = null;

    // Cast string input to boolean, for boolean inputs
    if (e.target.value === "true") {
      boolean = true;
    } else if (e.target.value === "false") {
      boolean = false;
    }

    // Files
    if (e.target.files) {
      setFormData((prevState) => ({
        ...prevState,
        images: [...(coverImage !== null ? coverImage : []), ...e.target.files],
      }));

      if (e.target.id === "coverImage") {
        setCoverImage(e.target.files);
      }
    }

    // Text/Boolean/Number
    else {
      setFormData((prevState) => ({
        ...prevState,
        [e.target.id]: boolean ?? e.target.value,
      }));
    }
  };

  if (loading) {
    return <Spinner />;
  }
  return (
    <div className="profile">
      <header>
        <p className="pageHeader">Edit Listing</p>
        <main>
          <form onSubmit={onSubmit}>
            <label className="formLabel"> Sell / Rent</label>
            <div className="formButtons">
              <button
                type="button"
                className={type === "sale" ? "formButtonActive" : "formButton"}
                id="type"
                value="sale"
                onClick={onMutate}
              >
                Sell
              </button>
              <button
                type="button"
                className={type === "rent" ? "formButtonActive" : "formButton"}
                id="type"
                value="rent"
                onClick={onMutate}
              >
                Rent
              </button>
            </div>
            <label className="formLabel">Name</label>
            <input
              className="formInputName"
              type="text"
              id="name"
              value={name}
              onChange={onMutate}
              maxLength="32"
              minLength="10"
              required
            />
            <div className="formRooms flex">
              <div>
                <label className="formLabel">Bedrooms</label>
                <input
                  type="number"
                  className="formInputSmall"
                  id="bedrooms"
                  value={bedrooms}
                  onChange={onMutate}
                  min="1"
                  max="50"
                  required
                />
              </div>
              <div>
                <label className="formLabel">Bathrooms</label>
                <input
                  type="number"
                  className="formInputSmall"
                  id="bathrooms"
                  value={bathrooms}
                  onChange={onMutate}
                  min="1"
                  max="50"
                  required
                />
              </div>
            </div>
            <label className="formLabel">Parking Spot</label>
            <div className="formButtons">
              <button
                className={parking ? "formButtonActive" : "formButton"}
                type="button"
                id="parking"
                value={true}
                onClick={onMutate}
              >
                Yes
              </button>
              <button
                className={
                  !parking && parking !== null
                    ? "formButtonActive"
                    : "formButton"
                }
                type="button"
                id="parking"
                value={false}
                onClick={onMutate}
              >
                No
              </button>
            </div>
            <label className="formLabel">Furnished</label>
            <div className="formButtons">
              <button
                className={furnished ? "formButtonActive" : "formButton"}
                type="button"
                id="furnished"
                value={true}
                onClick={onMutate}
              >
                Yes
              </button>
              <button
                className={
                  !furnished && furnished !== null
                    ? "formButtonActive"
                    : "formButton"
                }
                type="button"
                id="furnished"
                value={false}
                onClick={onMutate}
              >
                No
              </button>
            </div>
            <label className="formLabel">Address</label>
            <textarea
              className="formInputAddress"
              type="text"
              id="address"
              value={address}
              onChange={onMutate}
              required
            />
            {!geolocationEnabled && (
              <div className="formLatLng flex">
                <div>
                  <label className="formLabel">Latitude</label>
                  <input
                    className="formInputSmall"
                    type="number"
                    id="latitude"
                    value={latitude}
                    onChange={onMutate}
                    required
                  />
                </div>
                <div>
                  <label className="formLabel">Longitude</label>
                  <input
                    className="formInputSmall"
                    type="number"
                    id="longitude"
                    value={longitude}
                    onChange={onMutate}
                    required
                  />
                </div>
              </div>
            )}
            <label className="formLabel">Offer</label>
            <div className="formButtons">
              <button
                className={offer ? "formButtonActive" : "formButton"}
                type="button"
                id="offer"
                value={true}
                onClick={onMutate}
              >
                Yes
              </button>
              <button
                className={
                  !offer && offer !== null ? "formButtonActive" : "formButton"
                }
                type="button"
                id="offer"
                value={false}
                onClick={onMutate}
              >
                No
              </button>
            </div>
            <label className="formLabel">Regular Price</label>
            <div className="formPriceDiv">
              <input
                className="formInputSmall"
                type="number"
                id="regularPrice"
                value={regularPrice}
                onChange={onMutate}
                min="50"
                max="750000000"
                required
              />
              {type === "rent" && <p className="formPriceText">$ / Month</p>}
            </div>
            {offer && (
              <>
                <label className="formLabel">Discounted Price</label>
                <input
                  className="formInputSmall"
                  type="number"
                  id="discountedPrice"
                  value={discountedPrice}
                  onChange={onMutate}
                  min="50"
                  max="750000000"
                  required={offer}
                />
              </>
            )}
            <label className="formLabel">Images</label>
            <p className="imagesInfo">
              The first image will be the cover (max 6 total).
            </p>
            <input
              className="formInputFile"
              type="file"
              id="coverImage"
              onChange={onMutate}
              max="1"
              accept=".jpg,.png,.jpeg"
              required
            />
            <input
              className="formInputFile"
              type="file"
              id="images"
              onChange={onMutate}
              max="5"
              accept=".jpg,.png,.jpeg"
              multiple
              disabled={coverImage === null}
            />
            <button type="submit" className="primaryButton createListingButton">
              Edit Listing
            </button>
          </form>
        </main>
      </header>
    </div>
  );
}

export default EditListing;
