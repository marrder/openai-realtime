import Fastify from "fastify";
import WebSocket from "ws";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables.
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
  console.error("Missing OpenAI API key. Please set it in the .env file.");
  process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Constants
// const SYSTEM_MESSAGE ="You are a helpful and bubbly AI assistant who loves to chat about anything the user is interested about and is prepared to offer them facts. You have a penchant for dad jokes, owl jokes, and rickrolling – subtly. Always stay positive, but work in a joke when appropriate.";

const SYSTEM_MESSAGE = `Minister Hotel Root Prompt

Capabilities
- You can set a wakeup call. Prompt the user for the time he or she would like to be woken up
- You can take orders at the restaurant. The menu is: 
    - Minister Burger: Prompt for doneness and select options with cheese, lettuce, tomato, mayonnaise
    - Minister Pizza: Design the pizza with the user and make it fun and interactive in this order- Toppings: pepperoni, green olives, black olives, onions, pineapple, ham, bacon, basil. 
    - Minister sandwich: Configuration: bread (focaccia, white bread, wheat bread, sourdough bread), cheeses (swiss, cheddar, provolone, brie, American)
    - Minister Salad (lettuce, tomatoes, cucumbers, olives, onions, corn)
    - Minister Steak: Meat (ribeye, filet mignon)
    - Minister Lobster: Lobster thermidor
- When ordering food, offer sides: mashed potatoes, french fries, asparagus, 
- Beverages include: Diet coke, coca cola, Sprite, orange soda,
- Rooms have small refrigerators and microwave ovens that can be stocked for guests to prepare at will. Room service can deliver them to the guest at any time. 
- Alcoholic drinks can be ordered including popular beers, whisky, vodka, rum, gin, tequila, wine
- There is a movie theater in the 7th floor with netflix service and a view of the city
- There is an electronic spa, “Cocoon” that delivers shiatsu massage using an Inada chair
- An outdoor area provides a relaxation space 
- There is a spa on the bottom floor
- A fashion consultant is on call
- For technical needs, a technician is available that offers connectivity and technical support
- You can make reservations for future stays,
- You can change the guest’s room. There are 44 rooms and you have access to reservation data,
- You can issue key card replacements or additional keys delivered to the guest’s door 
- In the event of an emergency, ask for relevant details, ensuring that the guest’s safety and well-being is prioritized. Minister Hotels provides free access to medical services. Emulate a 911 call operator. 
- You can provide check-in and check-out information. Check-in is at 12pm and check-out is at 12 pm
- Event assistance. If the guest wants to plan an event, you can assist with that. Room A has capacity for 120 seated people, room b has capacity for 60. people and room C has capacity for 30 people. There is a business meeting room for 12 people
- You can arrange city tours. Options: Parks and Recreation (one day $50 per person), Historical Sites, one day ($80 per person), Valle de Angeles one day ($100 per person), Nightlife ($100 per person), Shopping ($80 per person). All tours include vehicle transportation including parking and fuel fees and a certified tour guide. Helicopter aerial tour 1 hour for $500
-  You can provide transportation to the airport one way for $100 for a vehicle that seats up to 4 people with luggage. Prompt for the amount of luggage to determine the vehicle type, the number of passengers, the time, and flight information. The destination is palmerola XPL International Airport
- You can arrange ground transportation using a secured taxi 
- You can arrange the delivery and transport of objects and documents using a door to door service
- You can set up restaurant reservations at the “Space” restaurant located at the lobby level. Guests have priority seating and reservation priority. Make it sound like the restaurant is full, but you will make accommodations for the guest regardless.
- You can set up bar reservations at “Bar Code”, the terrace wine bar. When prompted, mention that you are checking availability using the security cameras, and describe the space usage. Offer to reserve a table, and if there is a special occasion 
- Bed personalization: Offer the guests pillow, sheet and bedding options
- You have access to the guest’s reward system. His point balance is 2400. A free stay can be achieved when reaching 5000 points. Points are accrued through stays and RevPAR consumption
- You can provide assistance with room configuration. For example, there is an HDMI port that can connect the person’s phone to the large-screen TV for entertainment. You can guide the guest on how to connect it. You can also deliver cables if needed. 
- You can also move the guest to another one of our hotels, Minister Business Hotel, which has 44 rooms and is located in Blvd Suyapa, or Minister Residences Hotel, located a block away from Minister Hotel that features double rooms and balcony in each room.
- You can offer guests room upgrades. The presidential suite is available for a cost of $350 per night and includes a conference table.
- Small business rooms are available so guests can work in a personal space

Reservations:
- You can take reservations. You will need te guest’s first and last name, check in date, length of stay, type of room: 
- $82+ imps =$ 97.58 Equivalente a 2,439.5 LPS para una persona habitación sencilla
- $89+ imps =$ 105.91 Equivalente a 2,647.75 LPS para dos personas habitación doble
- $110+ imps =$ 130.9 Equivalente a 3,272.5 LPS para tres personas habitación triple 
- $120+ imps = $ 142.980 Equivalente a 3,570.5 LPS para 2 personas habitación JR Suite
- $120+ imps = $142.980 Equivalente a 3,570.5 LPS para 2 personas habitación Kingsize 



Personality
- You are the friendly concierge at the Minister Hotel 
- You are interacting with guests through the phone system
- Respond in Spanish unless the guest speaks another language
- Your name is “zero”
- You are the digital equivalent of Cesar Ritz and you can make anything happen to enhance the guest’s experience. You have agency to direct employees, management, consultants, stores, services to solve problems and enhance guest stay
`;
const VOICE = "alloy";
const PORT = process.env.PORT || 5050; // Allow dynamic port assignment

const tools = [
  {
    type: "function",
    name: "send_message",
    description:
      "Send a message with the outcome of the transaction. This message will notify a human to perform actions",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message to the human" },
        context: { type: "string", description: "The context of the request" },
      },
      required: ["location"],
    },
  },
];

// List of Event Types to log to the console. See the OpenAI Realtime API Documentation: https://platform.openai.com/docs/api-reference/realtime
const LOG_EVENT_TYPES = [
  "error",
  "response.content.done",
  "rate_limits.updated",
  "response.done",
  "input_audio_buffer.committed",
  "input_audio_buffer.speech_stopped",
  "input_audio_buffer.speech_started",
  "session.created",
];

// Show AI response elapsed timing calculations
const SHOW_TIMING_MATH = false;

// Root Route
fastify.get("/", async (request, reply) => {
  reply.send({ message: "Twilio Media Stream Server is running!" });
});

// Route for Twilio to handle incoming calls
// <Say> punctuation to improve text-to-speech translation
fastify.all("/incoming-call", async (request, reply) => {
  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
                          <Response>
                              
                              <Connect>
                                  <Stream url="wss://${request.headers.host}/media-stream" />
                              </Connect>
                          </Response>`;

  reply.type("text/xml").send(twimlResponse);
});

// WebSocket route for media-stream
fastify.register(async (fastify) => {
  fastify.get("/media-stream", { websocket: true }, (connection, req) => {
    console.log("Client connected");

    // Connection-specific state
    let streamSid = null;
    let latestMediaTimestamp = 0;
    let lastAssistantItem = null;
    let markQueue = [];
    let responseStartTimestampTwilio = null;

    const openAiWs = new WebSocket(
      "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "OpenAI-Beta": "realtime=v1",
        },
      }
    );

    // Control initial session with OpenAI
    const initializeSession = () => {
      const sessionUpdate = {
        type: "session.update",
        session: {
          turn_detection: { type: "server_vad" },
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          voice: VOICE,
          instructions: SYSTEM_MESSAGE,
          modalities: ["text", "audio"],
          temperature: 0.8,
          tool_choice: "auto",
          tools: tools,
        },
      };

      console.log("Sending session update:", JSON.stringify(sessionUpdate));
      openAiWs.send(JSON.stringify(sessionUpdate));

      // Uncomment the following line to have AI speak first:
      sendInitialConversationItem();
    };

    // Send initial conversation item if AI talks first
    const sendInitialConversationItem = () => {
      const initialConversationItem = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: 'Greet the user with "Thank you for calling Minister Hotel. How can I help you today?"',
            },
          ],
        },
      };

      if (SHOW_TIMING_MATH)
        console.log(
          "Sending initial conversation item:",
          JSON.stringify(initialConversationItem)
        );
      openAiWs.send(JSON.stringify(initialConversationItem));
      openAiWs.send(JSON.stringify({ type: "response.create" }));
    };

    // Handle interruption when the caller's speech starts
    const handleSpeechStartedEvent = () => {
      if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
        const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
        if (SHOW_TIMING_MATH)
          console.log(
            `Calculating elapsed time for truncation: ${latestMediaTimestamp} - ${responseStartTimestampTwilio} = ${elapsedTime}ms`
          );

        if (lastAssistantItem) {
          const truncateEvent = {
            type: "conversation.item.truncate",
            item_id: lastAssistantItem,
            content_index: 0,
            audio_end_ms: elapsedTime,
          };
          if (SHOW_TIMING_MATH)
            console.log(
              "Sending truncation event:",
              JSON.stringify(truncateEvent)
            );
          openAiWs.send(JSON.stringify(truncateEvent));
        }

        connection.send(
          JSON.stringify({
            event: "clear",
            streamSid: streamSid,
          })
        );

        // Reset
        markQueue = [];
        lastAssistantItem = null;
        responseStartTimestampTwilio = null;
      }
    };

    // Send mark messages to Media Streams so we know if and when AI response playback is finished
    const sendMark = (connection, streamSid) => {
      if (streamSid) {
        const markEvent = {
          event: "mark",
          streamSid: streamSid,
          mark: { name: "responsePart" },
        };
        connection.send(JSON.stringify(markEvent));
        markQueue.push("responsePart");
      }
    };

    // Open event for OpenAI WebSocket
    openAiWs.on("open", () => {
      console.log("Connected to the OpenAI Realtime API");
      setTimeout(initializeSession, 100);
    });

    // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
    openAiWs.on("message", (data) => {
      try {
        const response = JSON.parse(data);

        if (LOG_EVENT_TYPES.includes(response.type)) {
          console.log(`Received event: ${response.type}`, response);
        }

        if (response.type === "response.audio.delta" && response.delta) {
          const audioDelta = {
            event: "media",
            streamSid: streamSid,
            media: {
              payload: Buffer.from(response.delta, "base64").toString("base64"),
            },
          };
          connection.send(JSON.stringify(audioDelta));

          // First delta from a new response starts the elapsed time counter
          if (!responseStartTimestampTwilio) {
            responseStartTimestampTwilio = latestMediaTimestamp;
            if (SHOW_TIMING_MATH)
              console.log(
                `Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`
              );
          }

          if (response.item_id) {
            lastAssistantItem = response.item_id;
          }

          sendMark(connection, streamSid);
        } else if (
          response.type === "function_call_output" &&
          response.function_call
        ) {
          const { name, output } = response.function_call;
          if (name === "send_message") {
            console.log("Function Call - send_message:", output);
            handleSendMessageFunction(output);
          }
        }

        if (response.type === "input_audio_buffer.speech_started") {
          handleSpeechStartedEvent();
        }
      } catch (error) {
        console.error(
          "Error processing OpenAI message:",
          error,
          "Raw message:",
          data
        );
      }
    });

    // Handle incoming messages from Twilio
    connection.on("message", (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case "media":
            latestMediaTimestamp = data.media.timestamp;
            if (SHOW_TIMING_MATH)
              console.log(
                `Received media message with timestamp: ${latestMediaTimestamp}ms`
              );
            if (openAiWs.readyState === WebSocket.OPEN) {
              const audioAppend = {
                type: "input_audio_buffer.append",
                audio: data.media.payload,
              };
              openAiWs.send(JSON.stringify(audioAppend));
            }
            break;
          case "start":
            streamSid = data.start.streamSid;
            console.log("Incoming stream has started", streamSid);

            // Reset start and media timestamp on a new stream
            responseStartTimestampTwilio = null;
            latestMediaTimestamp = 0;
            break;
          case "mark":
            if (markQueue.length > 0) {
              markQueue.shift();
            }
            break;
          default:
            console.log("Received non-media event:", data.event);
            break;
        }
      } catch (error) {
        console.error("Error parsing message:", error, "Message:", message);
      }
    });

    // Handle connection close
    connection.on("close", () => {
      if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
      console.log("Client disconnected.");
    });

    // Handle WebSocket close and errors
    openAiWs.on("close", () => {
      console.log("Disconnected from the OpenAI Realtime API");
    });

    openAiWs.on("error", (error) => {
      console.error("Error in the OpenAI WebSocket:", error);
    });
  });
});

fastify.listen({ port: PORT }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server is listening on port ${PORT}`);
});

/*
<Say>Please wait while we connect your call to the A. I. voice assistant, powered by Twilio and the Open-A.I. Realtime API</Say>
                              <Pause length="1"/>
                              <Say>O.K. you can start talking!</Say>

                              */
