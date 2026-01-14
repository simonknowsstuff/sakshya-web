const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { VertexAI } = require("@google-cloud/vertexai");

const project = process.env.GCLOUD_PROJECT;
const location = "us-central1";

const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
        type: "object",
        properties: {
            timestamps: {
                type: "array",
                description: "A list of timestamps extracted from the video.",
                items: {
                    type: "object",
                    properties: {
                        from: {
                            type: "string",
                            description: "Start time of the timestamp in HH:MM:SS format."
                        },
                        to: {
                            type: "string",
                            description: "End time of the timestamp in HH:MM:SS format."
                        },
                        summary: {
                            type: "string",
                            description: "A brief summary of the content at the specified timestamp."
                        },
                        confidence: {
                            type: "number",
                            description: "Confidence score of the timestamp extraction (0 to 1)."
                        }
                    },
                    required: ["from", "to", "summary", "confidence"]
                }
            }
        },
        required: ["timestamps"]
    }
};

const vertex_ai = new VertexAI({ project: project, location: location });
const model = vertex_ai.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: generationConfig
});

exports.getTimestampsFromGemini = onCall(
    { 
        enforceAppCheck: true, 
        memory: "512MiB" 
    },
    async (req) => {
        if (!req.auth || !req.auth.uid) {
            throw new HttpsError(
                "unauthenticated", 
                "The function must be called while authenticated."
            );
        }

        const { storageUri, userPrompt, model: userModel } = req.data;
        if (!storageUri) {
            throw new HttpsError(
                "invalid-argument", 
                "The function must be called with a valid storageUri."
            );
        }
        if (!userPrompt) {
            throw new HttpsError(
                "invalid-argument", 
                "The function must be called with a valid userPrompt."
            );
        }

        const allowedModels = ['gemini-2.5-flash', 'gemini-2.5-pro'];
        if (userModel && !allowedModels.includes(userModel)) {
            throw new HttpsError(
                "invalid-argument",
                "The specified model is not supported."
            );
        }

        // If userModel is provided and valid, use it; otherwise, default to "gemini-2.5-flash"
        if (userModel && allowedModels.includes(userModel)) {
            model.model = userModel;
        } else {
            model.model = "gemini-2.5-flash";
        }

        try {
            const videoPart = {
                fileData: {
                    mimeType: "video/mp4",
                    fileUri: storageUri
                }
            };
            const textPart = {
                text: `
                    You are an expert forensic analyst specialised in extracting timestamps from a video.
                    Task: ${userPrompt}

                    Analyze the video strictly and find the exact timestamps.
                    Return the result strictly as JSON.
                `
            };

            const result = await model.generateContent({
                contents: [
                    { role: "user", parts: [videoPart, textPart] }
                ]
            });

            const responseData = result.response.candidates[0].content.parts[0].text;
            const parsedData = typeof responseData === "string" ? JSON.parse(responseData) : responseData;
            return parsedData;
        } catch (error) {
            console.error("Error during Gemini timestamp extraction:", error);
            throw new HttpsError(
                "internal", 
                "An error occurred while processing the video."
            );
        }
    }
)