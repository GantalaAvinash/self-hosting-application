import {
	deployApplication,
	deployCompose,
	deployPreviewApplication,
	rebuildApplication,
	rebuildCompose,
	updateApplicationStatus,
	updateCompose,
	updatePreviewDeployment,
} from "@dokploy/server";
import type { DeployJob } from "./schema";

export const deploy = async (job: DeployJob) => {
	if (!job.server) {
		throw new Error("Server information is missing. Cannot deploy without a server.");
	}

	if (!job.serverId) {
		throw new Error("Server ID is missing. Cannot deploy without a server ID.");
	}

	try {
		if (job.applicationType === "application") {
			if (!job.applicationId) {
				throw new Error("Application ID is missing for application deployment.");
			}
			await updateApplicationStatus(job.applicationId, "running");
			
			if (job.type === "redeploy") {
				await rebuildApplication({
					applicationId: job.applicationId,
					titleLog: job.titleLog || "Rebuild deployment",
					descriptionLog: job.descriptionLog || "",
				});
			} else if (job.type === "deploy") {
				await deployApplication({
					applicationId: job.applicationId,
					titleLog: job.titleLog || "Manual deployment",
					descriptionLog: job.descriptionLog || "",
				});
			} else {
				throw new Error(`Unknown deployment type: ${job.type}`);
			}
		} else if (job.applicationType === "compose") {
			if (!job.composeId) {
				throw new Error("Compose ID is missing for compose deployment.");
			}
			await updateCompose(job.composeId, {
				composeStatus: "running",
			});

			if (job.type === "redeploy") {
				await rebuildCompose({
					composeId: job.composeId,
					titleLog: job.titleLog || "Rebuild deployment",
					descriptionLog: job.descriptionLog || "",
				});
			} else if (job.type === "deploy") {
				await deployCompose({
					composeId: job.composeId,
					titleLog: job.titleLog || "Manual deployment",
					descriptionLog: job.descriptionLog || "",
				});
			} else {
				throw new Error(`Unknown deployment type: ${job.type}`);
			}
		} else if (job.applicationType === "application-preview") {
			if (!job.previewDeploymentId || !job.applicationId) {
				throw new Error("Preview deployment ID or application ID is missing.");
			}
			await updatePreviewDeployment(job.previewDeploymentId, {
				previewStatus: "running",
			});
			
			if (job.type === "deploy") {
				await deployPreviewApplication({
					applicationId: job.applicationId,
					titleLog: job.titleLog || "Preview Deployment",
					descriptionLog: job.descriptionLog || "",
					previewDeploymentId: job.previewDeploymentId,
				});
			} else {
				throw new Error(`Unknown deployment type for preview: ${job.type}`);
			}
		} else {
			throw new Error(`Unknown application type: ${job.applicationType}`);
		}
	} catch (e) {
		const errorMessage = e instanceof Error ? e.message : String(e);
		console.error("Deployment error:", errorMessage, e);
		
		try {
			if (job.applicationType === "application" && job.applicationId) {
				await updateApplicationStatus(job.applicationId, "error");
			} else if (job.applicationType === "compose" && job.composeId) {
				await updateCompose(job.composeId, {
					composeStatus: "error",
				});
			} else if (job.applicationType === "application-preview" && job.previewDeploymentId) {
				await updatePreviewDeployment(job.previewDeploymentId, {
					previewStatus: "error",
				});
			}
		} catch (statusError) {
			console.error("Failed to update deployment status after error:", statusError);
		}

		throw e;
	}

	return true;
};
