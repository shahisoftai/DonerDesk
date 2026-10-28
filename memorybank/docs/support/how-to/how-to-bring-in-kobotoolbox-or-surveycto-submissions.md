# Bring in KoboToolbox or SurveyCTO submissions

If your team already collects in KoboToolbox or SurveyCTO, DonorDesk can bring those submissions into a collection form. They arrive as records waiting for review, checked by the form's own questions.

## Connect

1. Open the published form, go to **KoboToolbox / SurveyCTO**, and choose **Connect KoboToolbox or SurveyCTO**. (The option is only offered when the server is set up for it.)
2. Give the connection a name, choose the tool, and enter the server address (it must start with https://).
3. Enter the form's id: for KoboToolbox the code at the end of the form's address; for SurveyCTO the form id.
4. Enter the key: for KoboToolbox your API token from your account settings; for SurveyCTO a user name and password written `user:password`. The key is kept encrypted and is never shown again.
5. For each question, write the name of the survey field that answers it. Leave a question empty if nothing answers it. Questions marked * must be answered.
6. Choose **Save the connection**.

## Check, then bring in

- **Check the connection** reads the submissions and reports how many are new, without saving anything.
- **Bring in new submissions** saves the new ones as records waiting for review. A submission brought in before is not stored twice.
- A submission that the form refuses is listed under **Not accepted**, with the reason. Fix the field names and bring in again; those submissions are tried again.

Photos and files are not brought in. A form must be published before submissions can be brought in.
