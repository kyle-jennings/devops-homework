# Your Location

## Set up
This website was created with [Jekyll](https://jekyllrb.com/docs/). I already have Jekyll site ready, you just need to run it locally.After you fork this repo, do the following to get set up:

1. Install a [Ruby environment](https://jekyllrb.com/docs/installation/) per Jekyll's documentation. 
2. Run `gem install jekyll bundler` in your terminal to install Jekyll
3. Run `bundle` in your to terminal to install all dependencies. 
4. Run `bundle exec jekyll serve --livereload`. See the documentation for [command line usage](https://jekyllrb.com/docs/usage/) if you have any questions. 
5. Check http://localhost:4000 to see if you're in business. 

## How Jekyll Works
Now that you have Jekyll running locally, you'll notice a new directory has appeared: `_site`. This directory is the complete site output that gets generated by Jekyll. You'll notice there's all of the pages, CSS, and JS compiled and ready for the world. This is what you need to host. You'll notice The homepage (`index.html`) is served from the root, but the privacy policy is served from the `privacy-policy` directory. I used [Jekyll's Collections feature](https://jekyllrb.com/docs/collections/) to keep my content organized and adding a custom [permalink](https://jekyllrb.com/docs/permalinks/) means it will be served from a named directory with an `index.html` file. So the path is `/privacy-policy/index.html` but we want the user to access it via `/privacy-policy/`.

Jekyll has [additional documentation](https://jekyllrb.com/docs/deployment/) on deployments if you need further guidance. 

# To deploy:

This repo has two branches, 'staging' and 'production' which are both the sources
for the staging and production sites.  The production sites are hosting on AWS S3 buckets.

Ideally each bucket is named after the URLs (mylocationhw.com staging.mylocationhw.com) but 
S3 buckets are global and might not be available.  In eithercase, CloudFront or CloudFlare will site infront of the buckets and will proxy the requests over to them.

To deploy. simply push your code to the appropriate branch and a it will be automatically
deployed.

## CI infrastructure
AWS CodePipeline is configured to listen to the repo's staging and production branches.
Whenever the branches are updated, CP will pull the code, run it through the build process
outlined below via CodeBuild, and then deploy the built code to the specified S3 bucket.

## Prepare S3 bucket
First thing is first, lets create a public S3 bukcet for staging, we are going
to not only make it public, but have it serve web pages.

1 - First create a new pipeline and name it staging.mylocationhw (and later '-production' )
2 - Enter the bucket and change the settings for 'Static website hosting' to
"Use this bucket to host a website".  
3 - enter index.html for either both the Index and Error documents.  Or set 404 for error.
4 - save
5 - Under "Permissions" make sure that "Block all public access" is set to off.
AWS has been changing its S3 security settings frequently lately and I have noticed that 
this setting will prevent granting access to the bucket.  We can and will change this later.
6 - Bucket policy, set that to this json object:
```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AddPerm",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::staging.mylocationhw/*"
        }
    ]
}
```

This basically says that all documents in the bucket are allowed to be viewed.
Without this, the documents would be "forbidden"

## Create the Code Pipeline
#### Step 1 - Settings
1 - Either create a new service role (AWS will build one for you) or choose an existing service role
2 - Under advanced settings, optionally change the "Artifact Store" to a specified S3 bucket.  
I prefer to do this in order to keep my S3 buckets tidy

#### Step 2 - Add source
1 - Select Github as the code source, and then click the 'connect" button which appears below the selection.
This will open a new window which connects to, and authorizes access to Github
2 - Use the reccomended settings of "Github Webhooks"

#### Step 3 - Add build state
1 - Select "AWS Code Build" from the dropdown which will display some new fields
2 - Click the "Create Project" button which willl open a new window to AWS Code build

#### Step 3A - Setup AWS Code Build
1 - Fill out a project name and description
2 - move down to "Operating System" and choose "Amazon Linux 2"
3 - Create a new service role and give it whatever name you want
4 - moveto the "Buildspec" section and select "insert build commands"
5 - below that radio button, click "Switch to editor" and replace the content with the following YAML
```
version: 0.2

phases:
  install:
    runtime-versions:
       ruby: 2.6
  pre_build:
    commands:
       - export LC_ALL="C.UTF-8"
       - export LANG="en_US.UTF-8"
       - export LANGUAGE="en_US.UTF-8" 
       - bundle install
  build:
    commands:
       - jekyll build
artifacts:
  files:
    - '**/*'
  discard-paths: no
  base-directory: '_site/'
```

##### note!
The build spec rules might need to be massaged later, especially as AWS updates
their systems.  Infact that concept applies to many parts of this process. AWS
deploys changings something like 150 times a day so the various nuances of their tools
changes very frequently.

#### Step 4 - Deploy
This step is very easy
1 - Select "Amazon S3" for the action provider
2 - Ensure the "Input artifacts" are the same as the "Output artifacts" named
in the previous step.  If you are using the Pipeline wizard, it should already be set for you.
3 - Select the S3 bucket we created in the "Prepare S3 bucket" mylocationhw-production
4 - Make sure you check "Extract file before deploy"

Once you save the pipeline, it should trigger and run through the process to build and
deploy the site to S3.

At this point, the site will be publically available at:
http://staging.mylocationhw.s3-website-us-east-1.amazonaws.com/

And we can view it at "staging.mylocationhw.com" if we point our DNS to
"http://staging.mylocationhw.s3-website-us-east-1.amazonaws.com/"

If we had named the bucket to a FQDN, something like "mylocationhw.com", then the
S3 website URL would be "http://mylocationhw.com.s3-website-us-east-1.amazonaws.com/"

And thus we could skip the DNS section and simply configure your domain to
point to "http://mylocationhw.com.s3-website-us-east-1.amazonaws.com/"

The instructions to do this vary depending on the domain registrar but it should
just be a matter of setting a cname record for the @ host to point to that address.

But we want to put a CDN in front of the bucket, both for security but also added performance and flexability.

## CDN
There are lots of options here.  You all had mentioned Cloudflare so I can touch
on both Cloudfront and Cloudwatch.

#### Cloudfront
A prerequsite for cloudflare is hard to decribe here, but basically we need to 
generate a free SSL certificate using AWS's service, but depending on where the
domain is registered the steps are very different.  Lets just assume we already have
a certificate downloaded (from a registrar that is NOT AWS) and have imported into Cloudfront.


1 - Click the create a distribution and then "get started" under the first section, "Web"
2 - Under "Origin domain name" select the S3 bucket we created way back in the
very first step
4 - Under "restrict bucket access", select "yes"
5 - Further down the page under "Viewer Protocol Policy" choose to redirect http to https
6 - Select your custom SSL certificate we set up in an imaginary step
7 - Set the "default root object" to "index.html"
maybe pre-8 - Set "Grant Read Permissions on Bucket" to "Yes, Update Bucket Policy" if available.  This might need to be set after creation
8 - Click the create button and after about 10 minutes of waiting  the cloud
9 - Adjust CDN settings to what is needed

#### Cloudflare
Less familiar with Cloudflare.  But the basics are, are to set up a DNS proxy (CNAME with with SSL termination) and point
it to the s3 bucket at "http://staging.mylocationhw.s3-website-us-east-1.amazonaws.com/"

Adjust CDN settings to what is needed

## DNS
Don't forget to poiint your DNS to either the Cloudfront distribution, will be named something like "dsfdsfds.cloudfront.net" or to Cloudflare's name servers.
