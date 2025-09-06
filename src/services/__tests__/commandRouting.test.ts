import { CommandRoutingService, commandRoutingService } from '../commandRouting';

describe('CommandRoutingService', () => {
  let service: CommandRoutingService;

  beforeEach(() => {
    service = new CommandRoutingService();
  });

  describe('Shell Command Detection', () => {
    const shellCommands = [
      // Basic file operations
      'ls',
      'ls -la',
      'll',
      'pwd',
      'cd ~',
      'cd /home/user',
      'mkdir test',
      'rmdir test',
      'rm file.txt',
      'cp file1 file2',
      'mv old new',
      
      // Text processing
      'cat file.txt',
      'grep pattern file.txt',
      'head -10 file.txt',
      'tail -f log.txt',
      'awk \'{print $1}\' file.txt',
      'sed \'s/old/new/g\' file.txt',
      
      // System operations
      'ps aux',
      'top',
      'htop',
      'kill 1234',
      'sudo systemctl restart nginx',
      'whoami',
      'date',
      'uptime',
      
      // Network
      'ping google.com',
      'curl https://api.example.com',
      'wget https://example.com/file.zip',
      'ssh user@server',
      
      // Package management
      'apt update',
      'yum install package',
      'npm install react',
      'pip install requests',
      'cargo build',
      
      // Development tools
      'git status',
      'git commit -m \"message\"',
      'docker ps',
      'docker run -it ubuntu',
      'kubectl get pods',
      
      // Shell patterns
      './script.sh',
      '/usr/bin/command',
      '~/bin/mycommand',
      'command | grep pattern',
      'command && other',
      'command || fallback',
      'command > output.txt',
      'command >> output.txt',
      'command < input.txt',
      'export VAR=value',
      'VAR=value command',
      
      // Command with flags
      'ls -la --color=auto',
      'ps aux --sort=-%cpu',
      'find . -name "*.js" -type f',
    ];

    test.each(shellCommands)('should detect "%s" as shell command', (command) => {
      expect(service.isShellCommand(command)).toBe(true);
    });

    test('should detect shell commands with high confidence', async () => {
      const testCommands = ['ls -la', 'git status', 'docker ps'];
      
      for (const command of testCommands) {
        const result = await service.routeCommand(command);
        expect(result.isShellCommand).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.suggestedAction).toBe('execute_shell');
      }
    });
  });

  describe('AI Query Detection', () => {
    const aiQueries = [
      // Question words
      'what is docker?',
      'how do I use git?',
      'why is my server slow?',
      'when should I use kubernetes?',
      'where can I find documentation?',
      'who created Linux?',
      
      // Conversational phrases
      'help me understand containers',
      'explain how git works',
      'show me how to deploy',
      'tell me about REST APIs',
      'can you help with debugging?',
      'could you explain the error?',
      'would you recommend a solution?',
      
      // Questions with question marks
      'How do I fix this error?',
      'What does this command do?',
      'Is there a better way?',
      'Can I automate this process?',
      
      // AI request phrases
      'generate a Dockerfile',
      'create a bash script',
      'write a python function',
      'suggest improvements for this code',
      'analyze this log file',
      'review my configuration',
      'debug this issue',
      'optimize my workflow',
      
      // Natural language patterns
      'i want to learn docker',
      'i need help with kubernetes',
      'i would like to optimize my code',
      'please help me understand',
      'can you help me fix this?',
      'how can i improve performance?',
      
      // Long descriptive queries
      'I\'m having trouble connecting to my database and getting timeout errors',
      'My React application is running slowly and I think it might be a memory leak',
      'The CI/CD pipeline keeps failing at the deployment step with exit code 1',
      'I need to set up monitoring for my microservices architecture',
    ];

    test.each(aiQueries)('should detect "%s" as AI query', (query) => {
      expect(service.isShellCommand(query)).toBe(false);
    });

    test('should detect AI queries with high confidence', async () => {
      const testQueries = [
        'what is docker?',
        'help me debug this error',
        'explain how kubernetes works'
      ];
      
      for (const query of testQueries) {
        const result = await service.routeCommand(query);
        expect(result.isShellCommand).toBe(false);
        expect(result.confidence).toBeGreaterThan(0.8);
        expect(result.suggestedAction).toBe('send_to_ai');
      }
    });
  });

  describe('Edge Cases', () => {
    const edgeCases = [
      // Ambiguous short inputs
      { input: 'test', expected: true, reason: 'Short command-like input' },
      { input: 'run', expected: true, reason: 'Could be shell command' },
      { input: 'help', expected: false, reason: 'AI trigger word' },
      { input: 'build', expected: true, reason: 'Common command' },
      
      // Mixed cases
      { input: 'Git Status', expected: true, reason: 'Case insensitive shell command' },
      { input: 'HOW TO USE GIT', expected: false, reason: 'Case insensitive AI trigger' },
      
      // Commands that might be confused
      { input: 'history', expected: true, reason: 'Shell command not AI query' },
      { input: 'history of git', expected: false, reason: 'AI query about history' },
      { input: 'man ls', expected: true, reason: 'Man page command' },
      { input: 'man please help', expected: false, reason: 'Conversational despite man' },
      
      // Special characters
      { input: 'echo "hello world"', expected: true, reason: 'Shell command with quotes' },
      { input: 'what does "hello world" mean?', expected: false, reason: 'Question with quotes' },
      
      // Numbers and paths
      { input: '/bin/bash', expected: true, reason: 'Absolute path' },
      { input: './configure --prefix=/usr', expected: true, reason: 'Configure script' },
      { input: 'cd ~/Documents/project', expected: true, reason: 'Path navigation' },
    ];

    test.each(edgeCases)('should handle "$input" correctly', async ({ input, expected, reason }) => {
      const result = service.isShellCommand(input);
      expect(result).toBe(expected);
      
      // Also test with detailed routing
      const detailedResult = await service.routeCommand(input);
      expect(detailedResult.isShellCommand).toBe(expected);
      
      // Log the reasoning for manual verification
      console.log(`"${input}" -> ${expected ? 'Shell' : 'AI'}: ${reason}`);
    });
  });

  describe('Confidence Levels', () => {
    test('should have high confidence for obvious shell commands', async () => {
      const obviousCommands = ['ls -la', 'git status', 'docker ps', 'npm install'];
      
      for (const command of obviousCommands) {
        const result = await service.routeCommand(command);
        expect(result.confidence).toBeGreaterThan(0.8);
        expect(result.isShellCommand).toBe(true);
      }
    });

    test('should have high confidence for obvious AI queries', async () => {
      const obviousQueries = [
        'what is docker?',
        'how do I use git?',
        'explain kubernetes to me',
        'help me debug this error'
      ];
      
      for (const query of obviousQueries) {
        const result = await service.routeCommand(query);
        expect(result.confidence).toBeGreaterThan(0.8);
        expect(result.isShellCommand).toBe(false);
      }
    });

    test('should have lower confidence for ambiguous inputs', async () => {
      const ambiguousInputs = ['test', 'run', 'build', 'start'];
      
      for (const input of ambiguousInputs) {
        const result = await service.routeCommand(input);
        // These might have lower confidence due to ambiguity
        console.log(`"${input}" confidence: ${(result.confidence * 100).toFixed(1)}%`);
      }
    });
  });

  describe('Detailed Analysis', () => {
    test('should provide detailed analysis with alternatives', async () => {
      const result = await service.analyzeCommand('test');
      
      expect(result.routing).toBeDefined();
      expect(result.alternatives).toBeDefined();
      expect(result.explanation).toBeDefined();
      expect(typeof result.explanation).toBe('string');
      expect(result.explanation).toContain('test');
    });

    test('should suggest alternatives for low confidence routing', async () => {
      // Force a potentially ambiguous command
      const result = await service.analyzeCommand('help');
      
      // Should provide alternatives if confidence is low
      if (result.routing.confidence < 0.8) {
        expect(result.alternatives.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Integration Tests', () => {
    test('should handle empty and whitespace inputs', () => {
      expect(service.isShellCommand('')).toBe(false);
      expect(service.isShellCommand('   ')).toBe(false);
      expect(service.isShellCommand('\t\n')).toBe(false);
    });

    test('should handle very long inputs', () => {
      const longCommand = 'find /very/long/path/to/somewhere -name "*.js" -type f -exec grep -l "pattern" {} \\; | head -20';
      expect(service.isShellCommand(longCommand)).toBe(true);
      
      const longQuery = 'I have a very complex issue with my distributed system where multiple microservices are failing to communicate properly and I need comprehensive help understanding the root cause and potential solutions';
      expect(service.isShellCommand(longQuery)).toBe(false);
    });

    test('should handle special characters correctly', () => {
      const specialCommands = [
        'grep -E "^[0-9]+$" file.txt',
        'awk \'/pattern/ {print $1}\'',
        'sed \'s/[[:space:]]\\+/ /g\'',
        'find . -regex ".*\\.(js|ts)$"'
      ];
      
      for (const command of specialCommands) {
        expect(service.isShellCommand(command)).toBe(true);
      }
    });
  });

  describe('Performance Tests', () => {
    test('should handle multiple rapid calls efficiently', () => {
      const commands = ['ls', 'what is ls?', 'git status', 'help me with git'];
      const startTime = Date.now();
      
      commands.forEach(cmd => {
        service.isShellCommand(cmd);
      });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100); // Should be very fast
    });
  });
});

// Additional manual testing scenarios
describe('Manual Test Cases', () => {
  test('realistic user scenarios', async () => {
    const scenarios = [
      { input: 'ls', expected: true, scenario: 'Simple file listing' },
      { input: 'what files are in this directory?', expected: false, scenario: 'Natural language equivalent' },
      { input: 'git log --oneline', expected: true, scenario: 'Git command with flags' },
      { input: 'show me the recent commits', expected: false, scenario: 'Natural language git query' },
      { input: 'docker ps -a', expected: true, scenario: 'Docker command' },
      { input: 'what containers are running?', expected: false, scenario: 'Natural language docker query' },
      { input: 'cd ~/projects', expected: true, scenario: 'Directory navigation' },
      { input: 'how do I navigate to my projects folder?', expected: false, scenario: 'Navigation help request' },
    ];

    for (const { input, expected, scenario } of scenarios) {
      const result = await commandRoutingService.routeCommand(input);
      console.log(`Scenario: ${scenario}`);
      console.log(`Input: "${input}"`);
      console.log(`Expected: ${expected ? 'Shell' : 'AI'}, Got: ${result.isShellCommand ? 'Shell' : 'AI'}`);
      console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`Reason: ${result.reason}`);
      console.log('---');
      
      expect(result.isShellCommand).toBe(expected);
    }
  });
});
