using System.Text;

namespace GameServer.Models
{
    public class StompFrame
    {
        public string Command { get; set; } = string.Empty;
        public Dictionary<string, string> Headers { get; set; } = new();
        public string Body { get; set; } = string.Empty;

        public static StompFrame? Parse(string raw)
        {
            int nullIdx = raw.IndexOf('\0');
            string data = nullIdx >= 0 ? raw[..nullIdx] : raw;
            int blankLine = data.IndexOf("\n\n");
            if (blankLine < 0) return null;

            string headerSection = data[..blankLine];
            string body = data[(blankLine + 2)..];
            string[] lines = headerSection.Split('\n');
            string command = lines[0].Trim();
            if (string.IsNullOrEmpty(command)) return null;

            var headers = new Dictionary<string, string>();
            for (int i = 1; i < lines.Length; i++)
            {
                int colon = lines[i].IndexOf(':');
                if (colon > 0)
                {
                    headers[lines[i][..colon]] = lines[i][(colon + 1)..];
                }
            }

            return new StompFrame { Command = command, Headers = headers, Body = body };
        }

        public string ToRaw()
        {
            var sb = new StringBuilder();
            sb.Append(Command).Append('\n');
            foreach (var header in Headers)
            {
                sb.Append(header.Key).Append(':').Append(header.Value).Append('\n');
            }
            sb.Append('\n').Append(Body).Append('\0');
            return sb.ToString();
        }

        public static StompFrame Message(string destination, string subscription, string body, string msgId)
        {
            return new StompFrame
            {
                Command = "MESSAGE",
                Headers = new Dictionary<string, string>
                {
                    { "destination", destination },
                    { "subscription", subscription },
                    { "message-id", msgId },
                    { "content-type", "application/json" }
                },
                Body = body
            };
        }

        public static StompFrame Connected(string version = "1.2")
        {
            return new StompFrame
            {
                Command = "CONNECTED",
                Headers = new Dictionary<string, string>
                {
                    { "version", version },
                    { "heart-beat", "0,0" }
                }
            };
        }
    }
}
