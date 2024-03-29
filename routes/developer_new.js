let Users = require("../models/developer_new").User;
let express = require("express");
const AWS = require("aws-sdk");
let router = express.Router();

multer = require("multer");
var multerS3 = require("multer-s3");

const { checkAuthAdmin, getCurrentUser } = require("../middleware/auth");
const { success, error, validation } = require("../helpers/responseApi");
const AwsApiConstants = require("../constants/envConstants");

AWS.config.update({
  secretAccessKey: AwsApiConstants.Secret_access_key,
  accessKeyId: AwsApiConstants.Access_key_ID,
  region: AwsApiConstants.bucket_region,
});
var s3 = new AWS.S3();

var upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: AwsApiConstants.bucket_name,
    ACL: "public-read",
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString());
    },
  }),
});

const getPagination = (page, size) => {
  const limit = size ? +size : 100;
  const offset = page ? page * limit : 0;

  return { limit, offset };
};

router.get("/", async (req, res) => {
  const { page, size, title } = req.query;

  let condition = {
    ...(title && {
      title: { $regex: new RegExp(title), $options: "i" },
    }),
  };

  const { limit, offset } = getPagination(page, size);

  Users.paginate(condition, { offset, limit })
    .then((data) => {
      res.status(200).json(
        success(
          "OK",
          {
            users: {
              totalDocs: data.totalDocs,
              docs: data.docs,
              totalPages: data.totalPages,
              currentPage: data.page - 1,
            },
          },
          res.statusCode
        )
      );
    })
    .catch((err) => {
      res
        .status(500)
        .json(
          error(
            err.message
              ? err.message
              : "Some error occurred while retrieving Developers.",
            res.statusCode
          )
        );
    });
});

router.get("/:id", async (req, res) => {
  let id = req.params.id;

  try {
    const user = await Users.findOne({ _id: id });
    res.status(200).json(success("OK", { user: user }, res.statusCode));
  } catch (err) {
    res
      .status(500)
      .json(
        error(
          err.message ? err.message : "Something went wrong.",
          res.statusCode
        )
      );
  }
});

router.post(
  "/",
  checkAuthAdmin,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  async (req, res, next) => {
    let {
      name,
      video_link,
      country,
      profession,
      rating,
      numJob,
      description,
      languages,
      experienceYear,
      rate,
    } = req.body;
    console.log("file", req.file);
    console.log("files", req.files);
    if (req.user.role == "ADMIN") {
      try {
        let newUser = new Users({
          avatar: req.files["avatar"][0].location,
          thumbnail: req.files["thumbnail"][0].location,
          name,
          video_link,
          country,
          profession,
          rating,
          numJob,
          description,
          languages,
          experienceYear,
          rate,
        });

        const result = await newUser.save();
        res.status(200).json(success("OK", { user: result }, res.statusCode));
      } catch (err) {
        res
          .status(500)
          .json(
            error(
              err.message ? err.message : "Something went wrong.",
              res.statusCode
            )
          );
      }
    } else {
      res.status(500).json(error("you are not authorized.", res.statusCode));
    }
  }
);

router.delete("/:id", checkAuthAdmin, async (req, res) => {
  let id = req.params.id;
  if (req.user.role == "ADMIN") {
    try {
      let developer = await Users.findOne({ _id: id });
      /* try {
                await fs.unlinkSync(developer.avatar);
            } catch (err2) {
                console.log("file delete error", err2);
            } */
      await Users.deleteOne({ _id: id });
      res.status(200).json(success("OK", { data: null }, res.statusCode));
    } catch (err) {
      res
        .status(500)
        .json(
          error(
            err.message ? err.message : "Something went wrong.",
            res.statusCode
          )
        );
    }
  } else {
    res.status(500).json(error("you are not authorized.", res.statusCode));
  }
});

router.patch(
  "/:id",
  checkAuthAdmin,
  upload.single("avatar"),
  async (req, res) => {
    let id = req.params.id;
    let reqBody = req.body;
    if (req.user.role == "ADMIN") {
      let teamMemberUpdates = {
        ...(reqBody.name && { name: reqBody.name }),
        ...(reqBody.profession && { profession: reqBody.profession }),
        ...(reqBody.rating && { company: reqBody.rating }),
        /* ...(req.file &&
                    req.file.filename && { avatar: DIR2 + req.file.filename }), */
        ...(req.file && req.file.location && { avatar: req.file.location }),
        ...(reqBody.numJob && { numJob: reqBody.numJob }),
        ...(reqBody.description && {
          description: reqBody.description,
        }),
        ...(reqBody.languages && { languages: reqBody.languages }),
        ...(reqBody.experienceYear && {
          experienceYear: reqBody.experienceYear,
        }),
        ...(reqBody.rate && { rate: reqBody.rate }),
      };

      try {
        const teamMember = await Users.updateOne(
          { _id: id },
          teamMemberUpdates
        );
        res
          .status(200)
          .json(success("OK", { teamMember: teamMember }, res.statusCode));
      } catch (err) {
        /* try {
                    await fs.unlinkSync(req.file.path);
                } catch (err2) {
                    console.log("file delete error", err2);
                } */
        res
          .status(500)
          .json(
            error(
              err.message ? err.message : "Something went wrong.",
              res.statusCode
            )
          );
      }
    } else {
      res.status(500).json(error("you are not authorized.", res.statusCode));
    }
  }
);

async function s3Upload(params) {
  const s3 = new AWS.S3({
    Id: AwsApiConstants.Access_key_ID,
    secretAccessKey: AwsApiConstants.Secret_access_key,
  });
  return new Promise((resolve) => {
    s3.upload(params, (err, data) => {
      if (err) {
        console.error(err);
        resolve(err);
      } else {
        resolve(data);
      }
    });
  });
}

module.exports = router;
