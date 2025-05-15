import { tool } from "@langchain/core/tools";
// import { langchain } from "@langchain/core";
import { z } from "zod";
import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { MessagesAnnotation, StateGraph } from "@langchain/langgraph";
import { CharacterTextSplitter } from "@langchain/textsplitters";
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

////embed functionality//////

// const largeembedding = new OllamaEmbeddings({ model: 'mxbai-embed-large' });
// const minembedding = new OllamaEmbeddings({ model: 'nomic-embed-text' });

// let embeddingQuery = await largeembedding.embedQuery('hello world, i am from earth and i am a human');
// let minembeddingQuery = await minembedding.embedQuery('hello world, i am from earth and i am a human');
// let minembeddingDocs = await minembedding.embedDocuments('./test.pdf');

// console.log('embeddingQueryyyyyyyyyyyyyyyyyy', embeddingQuery.length);
// console.log('minembeddingQueryyyyyyyyyyyyyyyyyy', minembeddingQuery.length);
// console.log('minembeddingDocuments', minembeddingDocs[0].length);

//text to sql

// let genratedSql = langchain.textToSql('fetch employees who are 50 or up in age');

let testString = `
Text is naturally organized into hierarchical units such as paragraphs, sentences, and words. We can leverage this inherent structure to inform our splitting strategy, creating split that maintain natural language flow, maintain semantic coherence within split, and adapts to varying levels of text granularity. LangChain's RecursiveCharacterTextSplitter implements this concept:

The RecursiveCharacterTextSplitter attempts to keep larger units (e.g., paragraphs) intact.
If a unit exceeds the chunk size, it moves to the next level (e.g., sentences).
This process continues down to the word level if necessary.
Here is example usage:

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 100,
  chunkOverlap: 0,
});
const texts = await textSplitter.splitText(document);

[Further reading]
See the how-to guide for recursive text splitting.
Document-structured based
Some documents have an inherent structure, such as HTML, Markdown, or JSON files. In these cases, it's beneficial to split the document based on its structure, as it often naturally groups semantically related text. Key benefits of structure-based splitting:

Preserves the logical organization of the document
Maintains context within each chunk
Can be more effective for downstream tasks like retrieval or summarization
Examples of structure-based splitting:

Markdown: Split based on headers (e.g., #, ##, ###)
HTML: Split using tags
JSON: Split by object or array elements
Code: Split by functions, classes, or logical blocks
`
async function textSplitTester() {
  const textSplitter = new CharacterTextSplitter({
    chunkSize: 100,
    chunkOverlap: 0,
  });
  const texts = await textSplitter.splitText(testString);
  console.log("splitted texts", texts);
}

textSplitTester();

// Define tools
const multiply = tool(
  async ({ a, b }) => {
    console.log('acccccccccccccccccccccccesssinnngg multiply',a,b)
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
    console.log('acccccccccccccccccccccccesssinnngg add',a,b)
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
    console.log('acccccccccccccccccccccccesssinnngg divide',a,b)
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
      console.log('acccccccccccccccccccccccesssinnngg round',a)
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
//console.log('tools', tools)
const toolsByName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
//console.log('toolsByName', toolsByName)
const llmWithTools = llm.bindTools(tools);
//console.log('llmWithTools', llmWithTools)

let toolNmaes = Object.entries(toolsByName).map(([name, tool]) => {
  return name
}).join(", ");

console.log('toolNmaes', toolNmaes)

// Nodes
async function llmCall(state) {
    // LLM decides whether to call a tool or not
    const result = await llmWithTools.invoke([
      {
        role: "system",
        content: `You are a helpful assistant tasked with performing arithmetic on a set of inputs. 
        to perform the arithmetic operations only use the provided tools ${toolNmaes},
        and also tell which tool u called and what was the input to that tool.
        You can also call the tools multiple times if needed.
        You can only call a tool if the input is valid and not empty. but u should also tell me if the input is invalid and why.
        and dont use your intelligent to perform the arithmetic operations, just use the tools.
        if the tool is not available, then tell me that the tool is not available.`
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
    console.log("=====================should continueeeeeeeeeeeeeeee=======",state,lastMessage.content);
    // console.log({ lastMessage });
    // console.log({messages})
    // If the LLM makes a tool call, then perform an action
    let returnValue = '';
    if (lastMessage?.tool_calls?.length) {
      console.log('returning Action ==================== sc call')
      return "Action";
    }
    // Otherwise, we stop (reply to the user)
    console.log('returning __end__ ==================== sc call')
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
    content: "add 7 plus 10 then multiply it by 3 and divide it by 2 and round it"
  },
  {
    role: "user",
    content: "what was my last quetion? if u do, then show me previous chats summary"
  }];
  const result =  await agentBuilder.invoke({ messages });
  //console.log(result.messages);