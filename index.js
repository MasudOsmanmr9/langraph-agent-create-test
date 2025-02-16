import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOllama } from "@langchain/ollama";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import {
  SystemMessage,
  ToolMessage
} from "@langchain/core/messages";
import {config} from "dotenv";

config();

//define llm
const llm = new ChatOllama({
    model: "llama3.2",  // Default value.
  });

// Define tools
const multiply = tool(
  async ({ a, b }) => {
    console.log('acccccccccccccccccccccccesssinnngg multiply')
    if(isNaN(a) && isNaN(b)){
        return "Invalid input";
    };
    return `${Number(a) * Number(b)}`;
  },
  {
    name: "multiply",
    description: "Multiply two numbers together",
    schema: z.object({
      a: z.string().describe("first number"),
      b: z.string().describe("second number"),
    }),
  }
);

const add = tool(
  async ({ a, b }) => {
    console.log('acccccccccccccccccccccccesssinnngg add')
    if(isNaN(a) && isNaN(b)){
        return "Invalid input";
    };
    return `${Number(a) + Number(b)}`;
  },
  {
    name: "add",
    description: "Add two numbers together",
    schema: z.object({
      a: z.string().describe("first number"),
      b: z.string().describe("second number"),
    }),
  }
);

const divide = tool(
  async ({ a, b }) => {
    console.log('acccccccccccccccccccccccesssinnngg divide')
    if(isNaN(a) && isNaN(b)){
        return "Invalid input";
    };
    return `${Number(a) / Number(b)}`;
  },
  {
    name: "divide",
    description: "Divide two numbers",
    schema: z.object({
      a: z.string().describe("first number"),
      b: z.string().describe("second number"),
    }),
  }
);

const resultBeutify = tool(
    async ({ a }) => {
      console.log('acccccccccccccccccccccccesssinnngg round')
      if(isNaN(a)){
          return "Invalid input";
      };
      return `${Math.round(Number(a))}`;
    },
    {
      name: "round",
      description: "round a number",
      schema: z.object({
        a: z.string().describe("first number"),
      }),
    }
  );

// Augment the LLM with tools
const tools = [add, multiply, divide, resultBeutify];
const toolsByName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
const llmWithTools = llm.bindTools(tools);


// Nodes
async function llmCall(state) {
    // LLM decides whether to call a tool or not
    const result = await llmWithTools.invoke([
      {
        role: "system",
        content: "You are a helpful assistant tasked with performing arithmetic on a set of inputs."
      },
      ...state.messages
    ]);
  
    return {
      messages: [result]
    };
}

async function toolNode(state) {
    // Performs the tool call
    const results = [];
    const lastMessage = state.messages.at(-1);
  
    if (lastMessage?.tool_calls?.length) {
      for (const toolCall of lastMessage.tool_calls) {
        const tool = toolsByName[toolCall.name];
        const observation = await tool.invoke(toolCall.args);
        results.push(
          new ToolMessage({
            content: observation,
            tool_call_id: toolCall.id,
          })
        );
      }
    }
  
    return { messages: results };
  }


  // Conditional edge function to route to the tool node or end
function shouldContinue(state) {
    const messages = state.messages;
    const lastMessage = messages.at(-1);
  
    // If the LLM makes a tool call, then perform an action
    if (lastMessage?.tool_calls?.length) {
      return "Action";
    }
    // Otherwise, we stop (reply to the user)
    return "__end__";
}


// Build workflow
const agentBuilder = new StateGraph(MessagesAnnotation)
  .addNode("llmCall", llmCall)
  .addNode("tools", toolNode)
  // Add edges to connect nodes
  .addEdge("__start__", "llmCall")
  .addConditionalEdges(
    "llmCall",
    shouldContinue,
    {
      // Name returned by shouldContinue : Name of next node to visit
      "Action": "tools",
      "__end__": "__end__",
    }
  )
  .addEdge("tools", "llmCall")
  .compile();

  
  // Invoke
  const messages = [{
    role: "user",
    content: "add 3 and 5  then add 8 with the result then multiply with 5 and divide by 2 and round the result"
  }];
  const result = await agentBuilder.invoke({ messages });
  console.log(result.messages);