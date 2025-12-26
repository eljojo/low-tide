package config

// Helper to find app by ID

func (c *Config) GetApp(id string) *AppConfig {
	for i := range c.Apps {
		if c.Apps[i].ID == id {
			return &c.Apps[i]
		}
	}
	return nil
}
