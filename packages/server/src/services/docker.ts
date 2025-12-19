import {
	execAsync,
	execAsyncRemote,
} from "@dokploy/server/utils/process/execAsync";

export const getContainers = async (serverId?: string | null) => {
	try {
		const command =
			"docker ps -a --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | Image: {{.Image}} | Ports: {{.Ports}} | State: {{.State}} | Status: {{.Status}}'";
		let stdout = "";
		let stderr = "";

		if (serverId) {
			const result = await execAsyncRemote(serverId, command);

			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}
		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const lines = stdout.trim().split("\n");

		const containers = lines
			.map((line) => {
				const parts = line.split(" | ");
				const containerId = parts[0]
					? parts[0].replace("CONTAINER ID : ", "").trim()
					: "No container id";
				const name = parts[1]
					? parts[1].replace("Name: ", "").trim()
					: "No container name";
				const image = parts[2]
					? parts[2].replace("Image: ", "").trim()
					: "No image";
				const ports = parts[3]
					? parts[3].replace("Ports: ", "").trim()
					: "No ports";
				const state = parts[4]
					? parts[4].replace("State: ", "").trim()
					: "No state";
				const status = parts[5]
					? parts[5].replace("Status: ", "").trim()
					: "No status";
				return {
					containerId,
					name,
					image,
					ports,
					state,
					status,
					serverId,
				};
			})
			.filter(
				(container) =>
					!container.name.includes("dokploy") ||
					container.name.includes("dokploy-monitoring"),
			);

		return containers;
	} catch (error) {
		console.error(error);

		return [];
	}
};

export const getConfig = async (
	containerId: string,
	serverId?: string | null,
) => {
	try {
		const command = `docker inspect ${containerId} --format='{{json .}}'`;
		let stdout = "";
		let stderr = "";
		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const config = JSON.parse(stdout);

		return config;
	} catch {}
};

export const getContainersByAppNameMatch = async (
	appName: string,
	appType?: "stack" | "docker-compose",
	serverId?: string,
) => {
	try {
		let result: string[] = [];
		const cmd =
			"docker ps -a --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'";

		const command =
			appType === "docker-compose"
				? `${cmd} --filter='label=com.docker.compose.project=${appName}'`
				: `${cmd} | grep '^.*Name: ${appName}'`;
		if (serverId) {
			const { stdout, stderr } = await execAsyncRemote(serverId, command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];
			result = stdout.trim().split("\n");
		} else {
			const { stdout, stderr } = await execAsync(command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];

			result = stdout.trim().split("\n");
		}

		const containers = result.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";

			const state = parts[2]
				? parts[2].replace("State: ", "").trim()
				: "No state";
			return {
				containerId,
				name,
				state,
			};
		});

		return containers || [];
	} catch {}

	return [];
};

export const getStackContainersByAppName = async (
	appName: string,
	serverId?: string,
) => {
	try {
		let result: string[] = [];

		const command = `docker stack ps ${appName} --format 'CONTAINER ID : {{.ID}} | Name: {{.Name}} | State: {{.DesiredState}} | Node: {{.Node}}'`;
		if (serverId) {
			const { stdout, stderr } = await execAsyncRemote(serverId, command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];
			result = stdout.trim().split("\n");
		} else {
			const { stdout, stderr } = await execAsync(command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];

			result = stdout.trim().split("\n");
		}

		const containers = result.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";

			const state = parts[2]
				? parts[2].replace("State: ", "").trim().toLowerCase()
				: "No state";
			const node = parts[3]
				? parts[3].replace("Node: ", "").trim()
				: "No specific node";
			return {
				containerId,
				name,
				state,
				node,
			};
		});

		return containers || [];
	} catch {}

	return [];
};

export const getServiceContainersByAppName = async (
	appName: string,
	serverId?: string,
) => {
	try {
		let result: string[] = [];

		const command = `docker service ps ${appName} --format 'CONTAINER ID : {{.ID}} | Name: {{.Name}} | State: {{.DesiredState}} | Node: {{.Node}}'`;

		if (serverId) {
			const { stdout, stderr } = await execAsyncRemote(serverId, command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];
			result = stdout.trim().split("\n");
		} else {
			const { stdout, stderr } = await execAsync(command);

			if (stderr) {
				return [];
			}

			if (!stdout) return [];

			result = stdout.trim().split("\n");
		}

		const containers = result.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";

			const state = parts[2]
				? parts[2].replace("State: ", "").trim().toLowerCase()
				: "No state";

			const node = parts[3]
				? parts[3].replace("Node: ", "").trim()
				: "No specific node";
			return {
				containerId,
				name,
				state,
				node,
			};
		});

		return containers || [];
	} catch {}

	return [];
};

export const getContainersByAppLabel = async (
	appName: string,
	type: "standalone" | "swarm",
	serverId?: string,
) => {
	try {
		let stdout = "";
		let stderr = "";

		const command =
			type === "swarm"
				? `docker ps --filter "label=com.docker.swarm.service.name=${appName}" --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`
				: type === "standalone"
					? `docker ps --filter "name=${appName}" --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`
					: `docker ps --filter "label=com.docker.compose.project=${appName}" --format 'CONTAINER ID : {{.ID}} | Name: {{.Names}} | State: {{.State}}'`;
		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}
		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		if (!stdout) return [];

		const lines = stdout.trim().split("\n");

		const containers = lines.map((line) => {
			const parts = line.split(" | ");
			const containerId = parts[0]
				? parts[0].replace("CONTAINER ID : ", "").trim()
				: "No container id";
			const name = parts[1]
				? parts[1].replace("Name: ", "").trim()
				: "No container name";
			const state = parts[2]
				? parts[2].replace("State: ", "").trim()
				: "No state";
			return {
				containerId,
				name,
				state,
			};
		});

		return containers || [];
	} catch {}

	return [];
};

export const containerRestart = async (containerId: string) => {
	try {
		const { stdout, stderr } = await execAsync(
			`docker container restart ${containerId}`,
		);

		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const config = JSON.parse(stdout);

		return config;
	} catch {}
};

export const getSwarmNodes = async (serverId?: string) => {
	try {
		let stdout = "";
		let stderr = "";
		const command = "docker node ls --format '{{json .}}'";

		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			const stderrLower = stderr.toLowerCase();
			if (
				stderrLower.includes("this node is not a swarm manager") ||
				stderrLower.includes("swarm is not initialized") ||
				stderrLower.includes("this node is not part of a swarm")
			) {
				console.warn("Docker Swarm is not initialized:", stderr);
				return [];
			}
			console.error(`Error getting swarm nodes: ${stderr}`);
			return [];
		}

		if (!stdout || stdout.trim() === "") {
			return [];
		}

		const lines = stdout.trim().split("\n").filter((line) => line.trim() !== "");
		if (lines.length === 0) {
			return [];
		}

		const nodesArray = lines.map((line) => {
			try {
				return JSON.parse(line);
			} catch (parseError) {
				console.error("Failed to parse node line:", line, parseError);
				return null;
			}
		}).filter((node) => node !== null);

		return nodesArray;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorLower = errorMessage.toLowerCase();
		
		if (
			errorLower.includes("swarm") &&
			(errorLower.includes("not initialized") ||
			 errorLower.includes("not a swarm manager") ||
			 errorLower.includes("not part of a swarm"))
		) {
			console.warn("Docker Swarm is not initialized");
			return [];
		}
		
		console.error("Error getting swarm nodes:", error);
		return [];
	}
};

export const getNodeInfo = async (nodeId: string, serverId?: string) => {
	try {
		const command = `docker node inspect ${nodeId} --format '{{json .}}'`;
		let stdout = "";
		let stderr = "";
		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			const stderrLower = stderr.toLowerCase();
			if (
				stderrLower.includes("swarm") &&
				(stderrLower.includes("not initialized") ||
				 stderrLower.includes("not a swarm manager") ||
				 stderrLower.includes("not part of a swarm"))
			) {
				console.warn("Docker Swarm is not initialized:", stderr);
				return null;
			}
			console.error(`Error getting node info: ${stderr}`);
			return null;
		}

		if (!stdout || stdout.trim() === "") {
			return null;
		}

		const nodeInfo = JSON.parse(stdout);
		return nodeInfo;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorLower = errorMessage.toLowerCase();
		
		if (
			errorLower.includes("swarm") &&
			(errorLower.includes("not initialized") ||
			 errorLower.includes("not a swarm manager") ||
			 errorLower.includes("not part of a swarm"))
		) {
			console.warn("Docker Swarm is not initialized");
			return null;
		}
		
		console.error("Error getting node info:", error);
		return null;
	}
};

export const getNodeApplications = async (serverId?: string) => {
	try {
		let stdout = "";
		let stderr = "";
		const command = `docker service ls --format '{{json .}}'`;

		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			const stderrLower = stderr.toLowerCase();
			if (
				stderrLower.includes("this node is not a swarm manager") ||
				stderrLower.includes("swarm is not initialized") ||
				stderrLower.includes("this node is not part of a swarm")
			) {
				console.warn("Docker Swarm is not initialized:", stderr);
				return [];
			}
			console.error(`Error getting node applications: ${stderr}`);
			return [];
		}

		if (!stdout || stdout.trim() === "") {
			return [];
		}

		const lines = stdout.trim().split("\n").filter((line) => line.trim() !== "");
		if (lines.length === 0) {
			return [];
		}

		const appArray = lines
			.map((line) => {
				try {
					return JSON.parse(line);
				} catch (parseError) {
					console.error("Failed to parse service line:", line, parseError);
					return null;
				}
			})
			.filter((service) => service !== null && !service.Name?.startsWith("dokploy-"));

		return appArray;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorLower = errorMessage.toLowerCase();
		
		if (
			errorLower.includes("swarm") &&
			(errorLower.includes("not initialized") ||
			 errorLower.includes("not a swarm manager") ||
			 errorLower.includes("not part of a swarm"))
		) {
			console.warn("Docker Swarm is not initialized");
			return [];
		}
		
		console.error("Error getting node applications:", error);
		return [];
	}
};

export const getApplicationInfo = async (
	appNames: string[],
	serverId?: string,
) => {
	try {
		let stdout = "";
		let stderr = "";
		const command = `docker service ps ${appNames.join(" ")} --format '{{json .}}' --no-trunc`;

		if (serverId) {
			const result = await execAsyncRemote(serverId, command);
			stdout = result.stdout;
			stderr = result.stderr;
		} else {
			const result = await execAsync(command);
			stdout = result.stdout;
			stderr = result.stderr;
		}

		if (stderr) {
			console.error(`Error: ${stderr}`);
			return;
		}

		const appArray = stdout
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line));

		return appArray;
	} catch {}
};
