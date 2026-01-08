import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { Appbar, Card, Searchbar, Text, useTheme } from 'react-native-paper';

export default function HistoryScreen() {
    const theme = useTheme();
    const [searchQuery, setSearchQuery] = useState('');

    const onChangeSearch = (query: string) => setSearchQuery(query);

    const historyData: { id: string, title: string, date: string, value: string }[] = [];

    const filteredData = historyData.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
            <Appbar.Header elevated>
                <Appbar.Content title="History" />
                <Appbar.Action icon="filter-variant" onPress={() => { }} />
            </Appbar.Header>

            <View className="p-4">
                <Searchbar
                    placeholder="Search measurements"
                    onChangeText={onChangeSearch}
                    value={searchQuery}
                    style={{ marginBottom: 16 }}
                />

                <FlatList
                    data={filteredData}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50, opacity: 0.5 }}>
                            <Text variant="bodyLarge">No measurements found</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <Card style={{ marginBottom: 12 }} onPress={() => { }}>
                            <Card.Title
                                title={item.title}
                                subtitle={item.date}
                                right={(props) => <Text {...props} variant="titleMedium" style={{ marginRight: 16 }}>{item.value}</Text>}
                            />
                        </Card>
                    )}
                />
            </View>
        </View>
    );
}
