interface ExampleWorkflowParmas {
	dataToPassIn;
}

interface ExampleQueueMessage {
	messageData;
}

interface Env extends Cloudflare.Env {
	ANTHROPIC_API_KEY: string;
}
